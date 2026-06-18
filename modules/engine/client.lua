local Engine = {}
local Config = require 'config.shared'
local Utils = require 'modules.utils.client'

lib.onCache('ped', function(value)
    Engine:applyFlags()
end)

function Engine:applyFlags()
    local playerPed = cache.ped
    SetPedConfigFlag(playerPed, 241, true) -- Prevent engine stopping
    SetPedConfigFlag(playerPed, 429, true) -- Prevent engine starting
    SetPedConfigFlag(playerPed, 184, true) -- Prevent auto-shuffle to driver from passenger seat
end

Citizen.CreateThread(function()
    if Config.Engine.preventDisable or Config.Locks.lockNpcVehicles then
        while true do
            Citizen.Wait(100)
            local vehicle = GetVehiclePedIsTryingToEnter(cache.ped)
            if vehicle and vehicle ~= 0 then
                if Config.Engine.preventDisable then
                    local engineOn = GetIsVehicleEngineRunning(vehicle)
                    if engineOn then
                        SetVehicleEngineOn(vehicle, true, true, true)
                    end
                end

                if Config.Locks.lockNpcVehicles then
                    local lockStatus = GetVehicleDoorLockStatus(vehicle)
                    local isOwned = IsVehiclePreviouslyOwnedByPlayer(vehicle)
                    local driverPed = GetPedInVehicleSeat(vehicle, -1)
                    if not isOwned and (driverPed == 0 or not IsPedAPlayer(driverPed)) then
                        if lockStatus == 1 and driverPed ~= 0 then
                            SetVehicleDoorsLocked(vehicle, 2)
                            ClearPedTasks(cache.ped)
                        elseif lockStatus > 2 then
                            SetVehicleDoorsLocked(vehicle, 1)
                            ClearPedTasks(cache.ped)
                        end
                    end
                end
            end
        end
    end
end)

function Engine:toggleEngine()
    local vehicle = cache.vehicle
    if not vehicle or vehicle == 0 then return end
    local vehicleClass = GetVehicleClass(vehicle)
    if Config.Engine.ignoreBikes and vehicleClass == 13 then
        return
    end

    local driverPed = GetPedInVehicleSeat(vehicle, -1)
    if driverPed ~= cache.ped then return end

    local vehPlate = Utils:trim(GetVehicleNumberPlateText(vehicle))
    local itemCount = Bridge.Inventory.getItemCount('car_key', {plate = vehPlate})
    if itemCount < 1 then return end

    local engineOn = GetIsVehicleEngineRunning(vehicle)
    SetVehicleEngineOn(vehicle, not engineOn, false, true)
    Bridge.Notify.showNotify(engineOn and locale('engine_off') or locale('engine_on'), 'success')
end

Citizen.CreateThread(function()
    Citizen.Wait(1000)
    if Config.Engine.keyBind then
        lib.addKeybind({
            name = 'p_vehiclekeys/toggleEngine',
            description = locale('keybind_toggle_engine'),
            defaultKey = Config.Engine.keyBind,
            onPressed = function()
                Engine:toggleEngine()
            end,
        })
    end

    Engine:applyFlags()
end)

if Config.Engine.ignoreBikes then
    lib.onCache('vehicle', function(value)
        if value and value ~= 0 then
            local vehicleClass = GetVehicleClass(value)
            if vehicleClass ~= 13 then
                return
            end

            SetVehicleEngineOn(value, true, true, true)
        end
    end)
end

if Config.Settings.keepSteeringWheel then
    local steeringAngles = {}
    local inVehicle = false
    lib.onCache('vehicle', function(value)
        inVehicle = value and value ~= 0
        if not value or value == 0 then
            local lastVehicle = GetVehiclePedIsIn(cache.ped, true)
            if lastVehicle and lastVehicle ~= 0 then
                local steeringAngle = steeringAngles[lastVehicle] or 0.0
                SetVehicleSteeringAngle(lastVehicle, steeringAngle)
                steeringAngles[lastVehicle] = nil
            end
        else
            Citizen.CreateThread(function()
                while inVehicle do
                    local currentVehicle = cache.vehicle
                    if not currentVehicle or currentVehicle == 0 or cache.seat ~= -1 then
                        break
                    end

                    local steeringAngle = GetVehicleSteeringAngle(currentVehicle)
                    if not GetIsTaskActive(cache.ped, 2) and steeringAngle and steeringAngle ~= 0.0 then
                        steeringAngles[currentVehicle] = steeringAngle
                    end

                    if GetIsTaskActive(cache.ped, 2) and steeringAngles[currentVehicle] then
                        SetVehicleSteeringAngle(currentVehicle, steeringAngles[currentVehicle])
                    end
                    Citizen.Wait(100)
                end
            end)
        end
    end)
end

return Engine