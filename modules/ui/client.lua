local UI = {}
local Utils = require 'modules.utils.client'
UI.Functions = {
    ['toggleLock'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        Locks:toggleLock(vehicle)
    end,
    ['toggleTrunk'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end
    end,
    ['honkHorn'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        Locks:playVehicleHorn(vehicle)
    end,
    ['findVehicle'] = function(data, cb)
        local vehicle = Utils:getVehicleByPlate(data.plate)
        if not vehicle or vehicle == 0 then
            return cb(1)
        end

        Locks:flashVehicleLights(vehicle)
    end,
}

Citizen.CreateThread(function()
    for name, func in pairs(UI.Functions) do
        RegisterNUICallback(name, func)
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

exports('useCarKey', function(data, slot)
    local vehPlate = slot?.metadata?.plate
    if not vehPlate or vehPlate == '' then
        return
    end

    local vehicle = Utils:getVehicleByPlate(vehPlate)
    if not vehicle or vehicle == 0 then
        Bridge.Notify.showNotify(locale('no_vehicle_found'), 'error')
        return
    end
    
    UI:Open({ plate = vehPlate, isLocked = GetVehicleDoorLockStatus(vehicle) >= 2 })
end)

RegisterCommand('keysUI', function()
    UI:Open()
end, false)

RegisterNUICallback('hideFrame', function(_, cb)
    SendNUIMessage({action = 'setVisibleApp', data = false})
    SetNuiFocus(false, false)
    cb(1)
end)