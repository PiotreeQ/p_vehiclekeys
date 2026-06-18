local UI = {}
local Utils = require 'modules.utils.client'
local Locks = require 'modules.locks.client'
local Theft = require 'modules.theft.client'
local forcedLights = {}

UI.Functions = {
    ['toggleLock'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        local isLocked = GetVehicleDoorLockStatus(vehicle) >= 2
        if data.state ~= nil and data.state == isLocked then
            return cb(1)
        end

        Locks:toggleLock(vehicle)
        cb(1)
    end,
    ['toggleTrunk'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        if Utils:requestControl(vehicle) then
            Utils:toggleTrunk(vehicle)
        end
        cb(1)
    end,
    ['toggleEngine'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        if not Utils:requestControl(vehicle) then
            return cb(1)
        end

        local engineOn = GetIsVehicleEngineRunning(vehicle)
        NetworkRequestControlOfEntity(vehicle)
        SetVehicleEngineOn(vehicle, not engineOn, true, true)
        Bridge.Notify.showNotify(engineOn and locale('engine_off') or locale('engine_on'), 'success')
        cb(1)
    end,
    ['toggleLights'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        if not Utils:requestControl(vehicle) then
            return cb(1)
        end

        if forcedLights[data.plate] then
            forcedLights[data.plate] = nil
            SetVehicleLights(vehicle, 1)
            Bridge.Notify.showNotify(locale('lights_off'), 'success')
        else
            forcedLights[data.plate] = true
            SetVehicleLights(vehicle, 2)
            Bridge.Notify.showNotify(locale('lights_on'), 'success')
        end
        cb(1)
    end,
    ['honkHorn'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        Locks:playVehicleHorn(vehicle)
        cb(1)
    end,
    ['findVehicle'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        Locks:flashVehicleLights(vehicle)
        cb(1)
    end,
}

Citizen.CreateThread(function()
    for name, func in pairs(UI.Functions) do
        RegisterNUICallback(name, function(data, cb)
            local vehPlate = type(data) == 'table' and data.plate or nil
            if not vehPlate or vehPlate == '' then
                return cb(1)
            end

            local itemCount = Bridge.Inventory.getItemCount('car_key', {plate = vehPlate})
            if itemCount < 1 then
                return cb(1)
            end

            func(data, cb)
        end)
    end
end)

function UI:Open(data)
    if not data or type(data) ~= 'table' then
        return
    end

    SendNUIMessage({action = 'setVisibleApp', data = true})
    SendNUIMessage({action = 'setData', data = data})
    SetNuiFocus(true, true)
end

function UI:openForPlate(vehPlate)
    if not vehPlate or vehPlate == '' then
        return
    end

    local vehicle = Utils:getVehicleByPlate(vehPlate)
    if not vehicle or vehicle == 0 then
        Bridge.Notify.showNotify(locale('no_vehicle_found'), 'error')
        return
    end

    UI:Open({ plate = vehPlate, isLocked = GetVehicleDoorLockStatus(vehicle) >= 2 })
end

-- ox_inventory calls this directly via the item's client.export
exports('useCarKey', function(data, slot)
    UI:openForPlate(slot?.metadata?.plate)
end)

RegisterNetEvent('p_vehiclekeys/client/keys/useCarKey', function(plate)
    UI:openForPlate(plate)
end)

RegisterNUICallback('hideFrame', function(data, cb)
    cb(1)
    SetNuiFocus(false, false)

    local frame = type(data) == 'table' and data.name or 'setVisibleApp'
    if frame ~= 'setVisibleApp' then
        ClearPedTasks(cache.ped)
        Theft:reset()
    end

    SendNUIMessage({action = frame, data = false})
end)

return UI
