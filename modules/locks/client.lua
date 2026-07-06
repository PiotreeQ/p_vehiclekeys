local Locks = {}
local Config = require 'config.shared'
local Utils = require 'modules.utils.client'

Locks.theftUnlocked = {}

function Locks:toggleLock(vehicleEntity)
    if not Config.Locks.canToggle() then
        return
    end

    local currentVehicle = vehicleEntity or cache.vehicle
    if currentVehicle then
        local vehPlate = Utils:trim(GetVehicleNumberPlateText(currentVehicle))
        if Bridge.Inventory.getItemCount('car_key', {plate = vehPlate}) < 1 then
            return
        end
    else
        local vehicles = lib.getNearbyVehicles(GetEntityCoords(cache.ped), 15.0, true)
        for _, v in ipairs(vehicles) do
            local vehPlate = Utils:trim(GetVehicleNumberPlateText(v.vehicle))
            if Bridge.Inventory.getItemCount('car_key', {plate = vehPlate}) > 0 then
                currentVehicle = v.vehicle
                break
            end
        end

        if not currentVehicle or currentVehicle == 0 then
            return
        end
    end

    if not NetworkGetEntityIsNetworked(currentVehicle) then return end

    if Config.Locks.ignoreBikes and GetVehicleClass(currentVehicle) == 13 then
        return
    end

    local netId = NetworkGetNetworkIdFromEntity(currentVehicle)
    local state = GetVehicleDoorLockStatus(currentVehicle) >= 2

    if not state and Config.Locks.requireClosedDoors then
        if not Locks:checkVehicleDoors(currentVehicle) then
            Bridge.Notify.showNotify(locale('doors_must_be_closed'), 'error')
            return
        end
    end

    TriggerServerEvent('p_vehiclekeys/server/locks/toggle', netId, state)
end

function Locks:playVehicleLock(entity)
    Citizen.CreateThread(function()
        if not DoesEntityExist(entity) then return end

        Citizen.Wait(500)
        SetVehicleLights(entity, 2)
        SetVehicleIndicatorLights(entity, 1, true)
        SetVehicleIndicatorLights(entity, 0, true)
        for i = 0, 5 do
            Citizen.Wait(0)
            SoundVehicleHornThisFrame(entity)
        end
        PlayVehicleDoorOpenSound(entity, 0)
        PlayVehicleDoorOpenSound(entity, 1)
        PlayVehicleDoorOpenSound(entity, 0)
        PlayVehicleDoorOpenSound(entity, 1)
        Citizen.Wait(200)
        SetVehicleLights(entity, 0)
        SetVehicleIndicatorLights(entity, 1, false)
        SetVehicleIndicatorLights(entity, 0, false)
        for i = 0, 5 do
            Citizen.Wait(0)
            SoundVehicleHornThisFrame(entity)
        end
        Citizen.Wait(200)
        SetVehicleLights(entity, 2)
        SetVehicleIndicatorLights(entity, 1, true)
        SetVehicleIndicatorLights(entity, 0, true)
        Citizen.Wait(200)
        SetVehicleLights(entity, 0)
        SetVehicleIndicatorLights(entity, 1, false)
        SetVehicleIndicatorLights(entity, 0, false)
    end)
end

function Locks:playVehicleHorn(entity)
    Citizen.CreateThread(function()
        if not DoesEntityExist(entity) then return end

        local endTime = GetGameTimer() + 1000
        while GetGameTimer() < endTime do
            Citizen.Wait(0)
            SoundVehicleHornThisFrame(entity)
        end
    end)
end

function Locks:flashVehicleLights(entity)
    Citizen.CreateThread(function()
        if not DoesEntityExist(entity) then return end

        local blip = nil
        if Config.Locks.findVehicleBlip then
            blip = AddBlipForEntity(entity)
            SetBlipSprite(blip, 225)
            SetBlipColour(blip, 5)
            SetBlipFlashes(blip, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentSubstringPlayerName(locale('blip_your_vehicle'))
            EndTextCommandSetBlipName(blip)
        end

        for i = 1, 6 do
            SetVehicleLights(entity, 2)
            SetVehicleIndicatorLights(entity, 0, true)
            SetVehicleIndicatorLights(entity, 1, true)
            for j = 0, 5 do
                Citizen.Wait(0)
                SoundVehicleHornThisFrame(entity)
            end
            Citizen.Wait(250)
            SetVehicleLights(entity, 0)
            SetVehicleIndicatorLights(entity, 0, false)
            SetVehicleIndicatorLights(entity, 1, false)
            Citizen.Wait(250)
        end

        Citizen.Wait(10000)
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end)
end

function Locks:playAnimLock()
    Citizen.CreateThread(function()
        if self.timer then
            self.timer:forceEnd(true)
            Citizen.Wait(100)
        end

        local keyProp = nil
        if Config.Locks.playAnimation == 'advanced' then
            local coords = GetEntityCoords(cache.ped)
            local keyModel = lib.requestModel('p_car_keys_01')
            keyProp = CreateObject(keyModel, coords.x, coords.y, coords.z - 2.0, true, true, true)
            AttachEntityToEntity(
                keyProp, cache.ped, GetPedBoneIndex(cache.ped, 57005),
                0.08, 0.039, 0.0, 0.0, 0.0, 0.0,
                true, true, false, true, 1, true
            )
            SetModelAsNoLongerNeeded(keyModel)
        end

        local animDict = lib.requestAnimDict('anim@mp_player_intmenu@key_fob@')
        TaskPlayAnim(cache.ped, animDict, 'fob_click', 8.0, -8.0, -1, 48, 0, false, false, false)
        RemoveAnimDict(animDict)
        self.timer = lib.timer(1000, function()
            ClearPedTasks(cache.ped)

            if keyProp and DoesEntityExist(keyProp) then
                DetachEntity(keyProp, false, false)
                DeleteEntity(keyProp)
            end
        end)
    end)
end

function Locks:checkVehicleDoors(entity)
    for i = 0, 5 do
        if not IsVehicleDoorDamaged(entity, i) and GetVehicleDoorAngleRatio(entity, i) > 0.0 then
            return false
        end
    end

    return true
end

function Locks:toggleLockState(netId, state, isSource)
    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then
        return
    end

    local lockState = state and 1 or 2
    SetVehicleDoorsLocked(entity, lockState)
    SetVehicleDoorsLockedForAllPlayers(entity, lockState == 2)
    self.theftUnlocked[entity] = state or nil

    if state then
        TriggerEvent('p_vehiclekeys/client/theft/stopAlarm', netId)
    end
    
    if Config.Locks.carEffect then
        Locks:playVehicleLock(entity)
    end

    if isSource then
        if type(Config.Locks.playAnimation) == 'string' and not cache.vehicle then
            Locks:playAnimLock()
        end

        Bridge.Notify.showNotify(state and locale('vehicle_unlocked') or locale('vehicle_locked'), 'success')
    end
end

RegisterNetEvent('p_vehiclekeys/client/locks/toggle', function(netId, state, isSource)
    Locks:toggleLockState(netId, state, isSource)
end)

Citizen.CreateThread(function()
    if Config.Locks.keyBind then
        lib.addKeybind({
            name = 'p_vehiclekeys/toggleLock',
            description = locale('keybind_toggle_lock'),
            defaultKey = Config.Locks.keyBind,
            onPressed = function()
                Locks:toggleLock()
            end,
        })
    end
end)

function Locks:useTool(entity)
    if not entity or entity == 0 then
        return
    end

    if not NetworkGetEntityIsNetworked(entity) then return end

    if Bridge.Progress.Start({
        duration = 45 * 1000,
        label = locale('using_unlock_tool'),
        useWhileDead = false,
        canCancel = true,
        anim = {
            dict = 'missmechanic',
            clip = 'work2_base',
            flag = 1,
        },
    }) then
        TriggerServerEvent('p_vehiclekeys/server/locks/unlockTool', NetworkGetNetworkIdFromEntity(entity))
    end
end

Bridge.Target.addVehicle({
    {
        name = 'unlock_tool_vehicle',
        icon = 'fas fa-key',
        label = locale('unlock_vehicle'),
        distance = 2.0,
        groups = Config.Locks.unlockToolJobs,
        canInteract = function(entity)
            return GetVehicleDoorLockStatus(entity) >= 2
        end,
        onSelect = function(data)
            local entity = type(data) == 'number' and data or data.entity
            Locks:useTool(entity)
        end
    }
})

return Locks
