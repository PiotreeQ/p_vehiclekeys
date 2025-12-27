local Locks = {}
local Config = require 'config.shared'
local Utils = require 'modules.utils.client'

function Locks:toggleLock(vehicleEntity)
    if not Config.Locks.canToggle() then
        return
    end

    local currentVehicle = vehicleEntity or cache.vehicle
    if currentVehicle then
        local vehPlate = Utils:trim(GetVehicleNumberPlateText(currentVehicle))
        local itemCount = Bridge.Inventory.getItemCount('car_key', {plate = vehPlate})
        if itemCount < 1 then
            return
        end
    else
        local vehicles = lib.getNearbyVehicles(GetEntityCoords(cache.ped), 15.0, true)
        for k, v in ipairs(vehicles) do
            local vehPlate = Utils:trim(GetVehicleNumberPlateText(v.vehicle))
            local itemCount = Bridge.Inventory.getItemCount('car_key', {plate = vehPlate})
            if itemCount > 0 then
                currentVehicle = v.vehicle
                break
            end
        end

        if not currentVehicle or currentVehicle == 0 then
            return
        end
    end

    if not NetworkGetEntityIsNetworked(currentVehicle) then return end

    local vehicleClass = GetVehicleClass(currentVehicle)
    if Config.Locks.ignoreBikes and vehicleClass == 13 then
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

function Locks:playAnimLock()
    Citizen.CreateThread(function()
        if self.timer then
            self.timer:forceEnd(true)
            Citizen.Wait(100)
        end

        local keyProp = nil
        if Config.Locks.playAnimation == 'advcanced' then
            local coords = GetEntityCoords(cache.ped)
            local keyModel = lib.requestModel('p_car_keys_01')
            keyProp = CreateObject(keyModel, coords.x, coords.y, coords.z - 2.0, true, true, true)
            AttachEntityToEntity(
                keyProp, cache.ped, GetPedBoneIndex(cache.ped, 57005), 
                0.08, 0.039, 0.0, 0.0, 0.0, 0.0, 
                true, true, false, true, 1, true
            )
        end

        lib.requestAnimDict('anim@mp_player_intmenu@key_fob@')
        TaskPlayAnim(cache.ped, 'anim@mp_player_intmenu@key_fob@', 'fob_click', 8.0, -8.0, -1, 48, 0, false, false, false)
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
        if GetVehicleDoorAngleRatio(entity, i) > 0.0 then
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
    if Config.Locks.carEffect then
        Locks:playVehicleLock(entity)
    end

    if isSource then
        if type(Config.Locks.playAnimation) == 'string' and not cache.vehicle then
            Locks:playAnimLock()
        end

        print('Toggled lock for vehicle ' .. netId .. ' to state ' .. tostring(state))
        Bridge.Notify.showNotify(state and locale('vehicle_unlocked') or locale('vehicle_locked'), 'success')
    end
end

RegisterNetEvent('p_vehiclekeys/client/locks/toggle', function(netId, state, isSource)
    Locks:toggleLockState(netId, state, isSource)
end)

Citizen.CreateThread(function()
    Citizen.Wait(1000)
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

return Locks