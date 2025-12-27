local Theft = {}
local Config = require 'config.shared'
local Utils = require 'modules.utils.client'
Theft.isLockpicking = false
Theft.isHotwiring = false
Theft.antiSpam = 0
Theft.currentDifficulty = nil

function Theft:getDifficulty(vehicle)
    local vehicleClass = GetVehicleClass(vehicle)
    return Config.Theft.vehicleClassDifficulty[vehicleClass] or 'medium'
end

function Theft:canLockpick()
    if self.isLockpicking then
        return false
    end

    if GetGameTimer() - self.antiSpam < Config.Theft.cooldown then
        Bridge.Notify.showNotify(locale('lockpick_cooldown'), 'error')
        return false
    end

    local itemCount = Bridge.Inventory.getItemCount(Config.Theft.requiredItem)
    if itemCount < 1 then
        Bridge.Notify.showNotify(locale('no_lockpick'), 'error')
        return false
    end

    return true
end

function Theft:startLockpick(vehicle)
    if not self:canLockpick() then return end
    if not vehicle or not DoesEntityExist(vehicle) then return end

    local lockStatus = GetVehicleDoorLockStatus(vehicle)
    if lockStatus <= 1 then
        Bridge.Notify.showNotify(locale('vehicle_already_unlocked'), 'info')
        return
    end

    self.isLockpicking = true
    self.antiSpam = GetGameTimer()
    
    local difficulty = self:getDifficulty(vehicle)
    self.currentDifficulty = difficulty
    local difficultyData = Config.Theft.difficulties[difficulty]

    local animDict = lib.requestAnimDict('veh@break_in@0h@p_m_one@')
    TaskPlayAnim(cache.ped, animDict, 'low_force_entry_ds', 3.0, 3.0, -1, 17, 0, false, false, false)
    RemoveAnimDict(animDict)

    if difficulty == 'expert' then
        SendNUIMessage({
            action = 'setVisibleJammer',
            data = true
        })
        
        SendNUIMessage({
            action = 'startJammer',
            data = {
                difficulty = 'hard',
                timeLimit = 25000
            }
        })
        
        SetNuiFocus(true, true)
        self.targetVehicle = vehicle
        return
    end

    SendNUIMessage({
        action = 'setVisibleLockpick',
        data = true
    })

    SendNUIMessage({
        action = 'startLockpick',
        data = {
            difficulty = difficulty,
            pins = difficultyData.pins,
            timeLimit = difficultyData.timeLimit
        }
    })

    SetNuiFocus(true, true)
    self.targetVehicle = vehicle
end

RegisterNUICallback('lockpickResult', function(data, cb)
    cb(1)
    SetNuiFocus(false, false)
    ClearPedTasks(cache.ped)
    
    if data.success then
        if Theft.targetVehicle and DoesEntityExist(Theft.targetVehicle) then
            local netId = NetworkGetNetworkIdFromEntity(Theft.targetVehicle)
            TriggerServerEvent('p_vehiclekeys/server/theft/unlockOnly', netId)
            Bridge.Notify.showNotify(locale('lockpick_success'), 'success')
        end
    else
        if data.reason == 'broken' then
            Bridge.Notify.showNotify(locale('lockpick_broken'), 'error')
            if Config.Theft.removeItemOnFail then
                TriggerServerEvent('p_vehiclekeys/server/theft/removeLockpick')
            end
        elseif data.reason == 'timeout' then
            Bridge.Notify.showNotify(locale('lockpick_timeout'), 'error')
        end
        
        if Config.Theft.alertPolice and data.reason ~= 'cancelled' then
            if math.random(100) <= Config.Theft.policeAlertChance then
                local coords = GetEntityCoords(cache.ped)
                TriggerServerEvent('p_vehiclekeys/server/theft/alertPolice', coords)
            end
        end
    end
    
    Wait(1500)
    SendNUIMessage({
        action = 'setVisibleLockpick',
        data = false
    })
    
    Theft.isLockpicking = false
    Theft.targetVehicle = nil
    Theft.currentDifficulty = nil
end)

RegisterNUICallback('jammerResult', function(data, cb)
    cb(1)
    
    if data.success then
        Bridge.Notify.showNotify(locale('jammer_success'), 'success')
        Wait(500)
        SendNUIMessage({
            action = 'setVisibleJammer',
            data = false
        })
        Wait(300)
        local difficultyData = Config.Theft.difficulties['expert']
        local animDict = lib.requestAnimDict('veh@break_in@0h@p_m_one@')
        TaskPlayAnim(cache.ped, animDict, 'low_force_entry_ds', 3.0, 3.0, -1, 17, 0, false, false, false)
        RemoveAnimDict(animDict)
        
        SendNUIMessage({
            action = 'setVisibleLockpick',
            data = true
        })
        
        SendNUIMessage({
            action = 'startLockpick',
            data = {
                difficulty = 'expert',
                pins = difficultyData.pins,
                timeLimit = difficultyData.timeLimit
            }
        })
        
        SetNuiFocus(true, true)
    else
        SetNuiFocus(false, false)
        ClearPedTasks(cache.ped)
        
        if data.reason == 'timeout' then
            Bridge.Notify.showNotify(locale('jammer_timeout'), 'error')
        else
            Bridge.Notify.showNotify(locale('jammer_failed'), 'error')
        end
        
        if Config.Theft.alertPolice then
            if math.random(100) <= Config.Theft.policeAlertChance then
                local coords = GetEntityCoords(cache.ped)
                TriggerServerEvent('p_vehiclekeys/server/theft/alertPolice', coords)
            end
        end
        
        Wait(1500)
        SendNUIMessage({
            action = 'setVisibleJammer',
            data = false
        })
        
        Theft.isLockpicking = false
        Theft.targetVehicle = nil
        Theft.currentDifficulty = nil
    end
end)

RegisterNUICallback('hotwireResult', function(data, cb)
    cb(1)
    SetNuiFocus(false, false)
    
    if data.success then
        if Theft.targetVehicle and DoesEntityExist(Theft.targetVehicle) then
            local netId = NetworkGetNetworkIdFromEntity(Theft.targetVehicle)
            TriggerServerEvent('p_vehiclekeys/server/theft/hotwire', netId)
            Bridge.Notify.showNotify(locale('hotwire_success'), 'success')
            
            -- Start the engine
            SetVehicleEngineOn(Theft.targetVehicle, true, false, true)
        end
    else
        if data.reason == 'shorted' then
            Bridge.Notify.showNotify(locale('hotwire_shorted'), 'error')
        elseif data.reason == 'timeout' then
            Bridge.Notify.showNotify(locale('hotwire_timeout'), 'error')
        else
            Bridge.Notify.showNotify(locale('hotwire_failed'), 'error')
        end
        
        if Config.Theft.alertPolice and data.reason ~= 'cancelled' then
            if math.random(100) <= Config.Theft.policeAlertChance then
                local coords = GetEntityCoords(cache.ped)
                TriggerServerEvent('p_vehiclekeys/server/theft/alertPolice', coords)
            end
        end
    end
    
    Wait(1500)
    SendNUIMessage({
        action = 'setVisibleHotwire',
        data = false
    })
    
    Theft.isHotwiring = false
    Theft.targetVehicle = nil
    Theft.currentDifficulty = nil
end)

RegisterNUICallback('hideFrame', function(data, cb)
    cb('ok')
    SetNuiFocus(false, false)
    ClearPedTasks(cache.ped)
    Theft.isLockpicking = false
    Theft.isHotwiring = false
    Theft.targetVehicle = nil
    Theft.currentDifficulty = nil
    
    SendNUIMessage({
        action = data.name,
        data = false
    })
end)

function Theft:canHotwire(vehicle)
    if self.isHotwiring then
        return false
    end
    
    if self.isLockpicking then
        return false
    end

    if not Config.Theft.canAttempt(vehicle) then
        return false
    end
    
    return true
end

function Theft:startHotwire(vehicle)
    vehicle = vehicle or cache.vehicle
    if not vehicle or not DoesEntityExist(vehicle) then
        Bridge.Notify.showNotify(locale('not_in_vehicle'), 'error')
        return
    end

    if not cache.vehicle or cache.vehicle ~= vehicle then
        Bridge.Notify.showNotify(locale('must_be_in_vehicle'), 'error')
        return
    end
    
    if GetIsVehicleEngineRunning(vehicle) then
        Bridge.Notify.showNotify(locale('engine_already_running'), 'info')
        return
    end

    if not self:canHotwire(vehicle) then return end
    
    self.isHotwiring = true
    self.targetVehicle = vehicle
    
    local difficulty = self:getDifficulty(vehicle)
    self.currentDifficulty = difficulty
    local hotwireTime = Config.Theft.hotwireTimes[difficulty] or 25000
    
    SendNUIMessage({
        action = 'setVisibleHotwire',
        data = true
    })
    
    SendNUIMessage({
        action = 'startHotwire',
        data = {
            difficulty = difficulty,
            timeLimit = hotwireTime
        }
    })
    
    SetNuiFocus(true, true)
end

exports('StartLockpick', function(vehicle)
    if not vehicle then
        return
    end

    Theft:startLockpick(vehicle)
end)

exports('StartHotwire', function(vehicle)
    Theft:startHotwire(vehicle or cache.vehicle)
end)

RegisterCommand('hotwire', function()
    Theft:startHotwire()
end)

Bridge.Target.addVehicle({
    {
        name = 'lockpick_vehicle',
        icon = 'fas fa-key',
        label = locale('lockpick_vehicle'),
        distance = 2.0,
        canInteract = function(entity)
            local lockStatus = GetVehicleDoorLockStatus(entity)
            return lockStatus >= 2
        end,
        onSelect = function(data)
            local entity = type(data) == 'number' and data or data.entity
            Theft:startLockpick(entity)
        end
    }
})

return Theft
