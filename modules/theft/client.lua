local Theft = {}
local Config = require 'config.shared'
local Utils = require 'modules.utils.client'
local DIFFICULTY_ORDER = {'easy', 'medium', 'hard', 'expert'}
local SECURITY_TIER_KEY = 'p_vehiclekeys:securityTier'

Theft.isLockpicking = false
Theft.isHotwiring = false
Theft.antiSpam = 0
Theft.targetVehicle = nil
Theft.hasWeapon = false
Theft.robbedPeds = {}
Theft.weaponThreadId = 0

function Theft:reset()
    self.isLockpicking = false
    self.isHotwiring = false
    self.targetVehicle = nil
end

function Theft:alertPolice()
    if not Config.Theft.alertPolice or math.random(1, 100) > Config.Theft.policeAlertChance then
        return
    end

    Bridge.Dispatch.SendAlert({
        title = locale('car_theft'),
        code = '10-90',
        icon = 'fa-solid fa-car',
        blip = {scale = 1.1, sprite = 225, color = 3, name = locale('car_theft')},
        priority = 'medium',
        maxOfficers = 3,
        time = 5,
        notify = 4000
    })
end

function Theft:triggerAlarm(vehicle, reason)
    if not Config.Theft.alarm or not Config.Theft.alarm.enabled then return end
    if not vehicle or not DoesEntityExist(vehicle) then return end
    TriggerServerEvent('p_vehiclekeys/server/theft/triggerAlarm', NetworkGetNetworkIdFromEntity(vehicle), reason)
end

function Theft:playBreakInAnim()
    local animDict = lib.requestAnimDict('veh@break_in@0h@p_m_one@')
    TaskPlayAnim(cache.ped, animDict, 'low_force_entry_ds', 3.0, 3.0, -1, 17, 0, false, false, false)
    RemoveAnimDict(animDict)
end

function Theft:getSecurityTier(vehicle)
    if not vehicle or not DoesEntityExist(vehicle) then
        return 1
    end

    local state = Entity(vehicle).state[SECURITY_TIER_KEY]
    if state then
        return state
    end

    local plate = Utils:trim(GetVehicleNumberPlateText(vehicle))
    if plate and plate ~= '' then
        local tier = lib.callback.await('p_vehiclekeys:getVehicleSecurityTier', false, plate)
        if tier then
            return tier
        end
    end

    return 1
end

function Theft:getDifficulty(vehicle)
    local baseDifficulty = Config.Theft.vehicleClassDifficulty[GetVehicleClass(vehicle)] or 'medium'
    local currentIndex = 1
    for i, diff in ipairs(DIFFICULTY_ORDER) do
        if diff == baseDifficulty then
            currentIndex = i
            break
        end
    end

    local newIndex = math.min(currentIndex + self:getSecurityTier(vehicle) - 1, #DIFFICULTY_ORDER)
    return DIFFICULTY_ORDER[newIndex]
end

function Theft:requiresJammer(vehicle)
    local difficulty = self:getDifficulty(vehicle)
    if difficulty == 'expert' then
        return true
    end

    local tier = self:getSecurityTier(vehicle)
    return tier >= 3 or (tier >= 2 and difficulty == 'hard')
end

function Theft:canLockpick(vehicle)
    if not Config.Theft.canAttempt(vehicle) then
        return false
    end

    if self.isLockpicking then
        return false
    end

    if self.antiSpam > GetGameTimer() then
        Bridge.Notify.showNotify(locale('lockpick_cooldown'), 'error')
        return false
    end

    if Bridge.Inventory.getItemCount('lockpick') < 1 then
        Bridge.Notify.showNotify(locale('no_lockpick'), 'error')
        return false
    end

    if self:requiresJammer(vehicle) and Bridge.Inventory.getItemCount('signal_jammer') < 1 then
        Bridge.Notify.showNotify(locale('you_need_signal_jammer'), 'error')
        return false
    end

    local vehModel = string.lower(GetDisplayNameFromVehicleModel(GetEntityModel(vehicle)))
    if Config.Theft.blacklistedModels[vehModel] then
        Bridge.Notify.showNotify(locale('you_cannot_lockpick'), 'error')
        return false
    end

    return true
end

function Theft:startLockpick(vehicle)
    if not self:canLockpick(vehicle) then return end
    if not vehicle or not DoesEntityExist(vehicle) then return end
    if #(GetEntityCoords(vehicle) - GetEntityCoords(cache.ped)) > 5.0 then return end

    if GetVehicleDoorLockStatus(vehicle) <= 1 then
        Bridge.Notify.showNotify(locale('vehicle_already_unlocked'), 'info')
        return
    end


    local difficulty = self:getDifficulty(vehicle)
    local tier = self:getSecurityTier(vehicle)
    self.isLockpicking = true
    self.antiSpam = GetGameTimer() + Config.Theft.cooldown
    self.targetVehicle = vehicle
    self:playBreakInAnim()

    if Config.Theft.alarm.enabled and tier >= Config.Theft.alarm.onStartMinTier then
        self:triggerAlarm(vehicle, 'start')
    end

    if difficulty == 'expert' then
        SendNUIMessage({action = 'setVisibleJammer', data = true})
        SendNUIMessage({
            action = 'startJammer',
            data = {
                difficulty = 'hard',
                timeLimit = 25000
            }
        })
        SetNuiFocus(true, true)
        return
    end

    local difficultyData = Config.Theft.difficulties[difficulty]
    SendNUIMessage({action = 'setVisibleLockpick', data = true})
    SendNUIMessage({
        action = 'startLockpick',
        data = {
            difficulty = difficulty,
            pins = difficultyData.pins,
            timeLimit = difficultyData.timeLimit
        }
    })
    SetNuiFocus(true, true)
end

RegisterNUICallback('lockpickResult', function(data, cb)
    cb(1)
    SetNuiFocus(false, false)
    ClearPedTasks(cache.ped)

    if data.success then
        if Theft.targetVehicle and DoesEntityExist(Theft.targetVehicle) then
            local netId = NetworkGetNetworkIdFromEntity(Theft.targetVehicle)
            TriggerServerEvent('p_vehiclekeys/server/theft/unlock', netId)
            Bridge.Notify.showNotify(locale('lockpick_success'), 'success')
        end
    else
        if data.reason == 'broken' then
            Bridge.Notify.showNotify(locale('lockpick_broken'), 'error')
            if Config.Theft.removeItemOnFail then
                TriggerServerEvent('p_bridge/server/removeItem', 'lockpick', 1)
            end
        elseif data.reason == 'timeout' then
            Bridge.Notify.showNotify(locale('lockpick_timeout'), 'error')
        end

        if data.reason ~= 'cancelled' then
            Theft:alertPolice()
            if Config.Theft.alarm.enabled and Config.Theft.alarm.onFail.lockpick then
                Theft:triggerAlarm(Theft.targetVehicle, 'fail')
            end
        end
    end

    Wait(1500)
    SendNUIMessage({action = 'setVisibleLockpick', data = false})
    Theft:reset()
end)

RegisterNUICallback('jammerResult', function(data, cb)
    cb(1)

    if data.success then
        TriggerServerEvent('p_bridge/server/removeItem', 'signal_jammer', 1)
        Bridge.Notify.showNotify(locale('jammer_success'), 'success')
        Wait(500)
        SendNUIMessage({action = 'setVisibleJammer', data = false})
        Wait(300)

        Theft:playBreakInAnim()
        local difficultyData = Config.Theft.difficulties['expert']
        SendNUIMessage({action = 'setVisibleLockpick', data = true})
        SendNUIMessage({
            action = 'startLockpick',
            data = {
                difficulty = 'expert',
                pins = difficultyData.pins,
                timeLimit = difficultyData.timeLimit
            }
        })
        SetNuiFocus(true, true)
        return
    end

    SetNuiFocus(false, false)
    ClearPedTasks(cache.ped)
    Bridge.Notify.showNotify(locale(data.reason == 'timeout' and 'jammer_timeout' or 'jammer_failed'), 'error')
    Theft:alertPolice()
    if Config.Theft.alarm.enabled and Config.Theft.alarm.onFail.jammer then
        Theft:triggerAlarm(Theft.targetVehicle, 'fail')
    end

    Wait(1500)
    SendNUIMessage({action = 'setVisibleJammer', data = false})
    Theft:reset()
end)

RegisterNUICallback('hotwireResult', function(data, cb)
    cb(1)
    SetNuiFocus(false, false)

    if data.success then
        if Theft.targetVehicle and DoesEntityExist(Theft.targetVehicle) then
            local netId = NetworkGetNetworkIdFromEntity(Theft.targetVehicle)
            Bridge.Notify.showNotify(locale('hotwire_success'), 'success')
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

        if data.reason ~= 'cancelled' then
            Theft:alertPolice()
            if Config.Theft.alarm.enabled and Config.Theft.alarm.onFail.hotwire then
                Theft:triggerAlarm(Theft.targetVehicle, 'fail')
            end
        end
    end

    Wait(1500)
    SendNUIMessage({action = 'setVisibleHotwire', data = false})
    Theft:reset()
end)

function Theft:canHotwire(vehicle)
    if self.isHotwiring or self.isLockpicking then
        return false
    end

    
    if self.antiSpam > GetGameTimer() then
        Bridge.Notify.showNotify(locale('lockpick_cooldown'), 'error')
        return false
    end

    if Bridge.Inventory.getItemCount('lockpick') < 1 then
        Bridge.Notify.showNotify(locale('no_lockpick'), 'error')
        return false
    end

    if self:requiresJammer(vehicle) and Bridge.Inventory.getItemCount('signal_jammer') < 1 then
        Bridge.Notify.showNotify(locale('you_need_signal_jammer'), 'error')
        return false
    end

    local vehModel = string.lower(GetDisplayNameFromVehicleModel(GetEntityModel(vehicle)))
    if Config.Theft.blacklistedModels[vehModel] then
        Bridge.Notify.showNotify(locale('you_cannot_lockpick'), 'error')
        return false
    end 

    return Config.Theft.canAttempt(vehicle)
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
    local tier = self:getSecurityTier(vehicle)

    if Config.Theft.alarm.enabled and tier >= Config.Theft.alarm.onStartMinTier then
        self:triggerAlarm(vehicle, 'start')
    end

    SendNUIMessage({action = 'setVisibleHotwire', data = true})
    SendNUIMessage({
        action = 'startHotwire',
        data = {
            difficulty = difficulty,
            timeLimit = Config.Theft.hotwireTimes[difficulty] or 25000
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

function Theft:canUpgradeSecurity(vehicle)
    if not Config.SecurityUpgrade.enabled then
        return false
    end

    local upgradeConfig = Config.SecurityUpgrade.upgrades[self:getSecurityTier(vehicle) + 1]
    if not upgradeConfig then
        return false
    end

    local plyJob = Bridge.Framework.fetchPlayerJob()
    local jobName = type(plyJob) == 'table' and plyJob.name or plyJob
    if not Config.SecurityUpgrade.requiredJob or not lib.table.contains(Config.SecurityUpgrade.requiredJob, jobName) then
        return false
    end

    return Bridge.Inventory.getItemCount(upgradeConfig.requiredItem) >= upgradeConfig.itemCount
end

function Theft:upgradeSecurity(vehicle)
    if not vehicle or not DoesEntityExist(vehicle) then
        return
    end

    if not Config.SecurityUpgrade.enabled then
        return
    end

    local upgradeConfig = Config.SecurityUpgrade.upgrades[self:getSecurityTier(vehicle) + 1]
    if not upgradeConfig then
        Bridge.Notify.showNotify(locale('upgrade_already_maxed'), 'info')
        return
    end

    local plyJob = Bridge.Framework.fetchPlayerJob()
    local jobName = type(plyJob) == 'table' and plyJob.name or plyJob
    if not Config.SecurityUpgrade.requiredJob or not lib.table.contains(Config.SecurityUpgrade.requiredJob, jobName) then
        Bridge.Notify.showNotify(locale('upgrade_job_required'), 'error')
        return
    end

    if Bridge.Inventory.getItemCount(upgradeConfig.requiredItem) < upgradeConfig.itemCount then
        Bridge.Notify.showNotify(string.format(locale('upgrade_missing_item'), upgradeConfig.requiredItem), 'error')
        return
    end

    if Bridge.Progress.Start({
        duration = upgradeConfig.duration,
        label = locale('upgrading_security'),
        useWhileDead = false,
        canCancel = true,
        anim = {
            dict = 'missmechanic',
            clip = 'work2_base',
            flag = 1,
        },
    }) then
        TriggerServerEvent('p_vehiclekeys/server/theft/upgradeSecurity', NetworkGetNetworkIdFromEntity(vehicle))
    end
end

Bridge.Target.addVehicle({
    {
        name = 'lockpick_vehicle',
        icon = 'fas fa-key',
        label = locale('lockpick_vehicle'),
        distance = 2.0,
        canInteract = function(entity)
            return GetVehicleDoorLockStatus(entity) >= 2
        end,
        onSelect = function(data)
            local entity = type(data) == 'number' and data or data.entity
            Theft:startLockpick(entity)
        end
    },
    {
        name = 'upgrade_security_vehicle',
        icon = 'fas fa-shield',
        label = locale('upgrade_security'),
        distance = 2.0,
        groups = Config.SecurityUpgrade.requiredJob,
        canInteract = function(entity)
            return Theft:canUpgradeSecurity(entity)
        end,
        onSelect = function(data)
            local entity = type(data) == 'number' and data or data.entity
            Theft:upgradeSecurity(entity)
        end
    }
})

function Theft:weaponThread()
    self.hasWeapon = true
    self.weaponThreadId = self.weaponThreadId + 1
    local currentThreadId = self.weaponThreadId
    Citizen.CreateThread(function()
        while self.hasWeapon and currentThreadId == self.weaponThreadId do
            local sleep = 1500
            if not cache.vehicle and IsPlayerFreeAiming(cache.playerId) then
                sleep = 500
                local plyCoords = GetEntityCoords(cache.ped)
                local ped, coords = lib.getClosestPed(plyCoords, 10.0)
                if ped and ped ~= 0 and not self.robbedPeds[ped] and not IsPedAPlayer(ped) and IsPedInAnyVehicle(ped, false)
                and not IsPedDeadOrDying(ped) and IsPlayerFreeAimingAtEntity(cache.playerId, ped) then
                    local vehicle = GetVehiclePedIsIn(ped, false)
                    if GetEntitySpeed(vehicle) < 5 then
                        self.robbedPeds[ped] = true
                        ClearPedTasks(ped)
                        Citizen.Wait(100)
                        TaskSetBlockingOfNonTemporaryEvents(ped, true)
                        Citizen.Wait(400)
                        TaskHandsUp(ped, -1, true, -1, true)
                        Citizen.Wait(2500)
                        TaskLeaveVehicle(ped, vehicle, 256)
                        Citizen.Wait(500)
                        TaskSmartFleePed(ped, cache.ped, 50.0, -1)
                        local vehPlate = Utils:trim(GetVehicleNumberPlateText(vehicle))
                        TriggerServerEvent('p_vehiclekeys/createKey', vehPlate, NetworkGetNetworkIdFromEntity(vehicle))
                        Bridge.Notify.showNotify(locale('theft_key_obtained'), 'success')
                    end
                end
            end
            Citizen.Wait(sleep)
        end
    end)
end

lib.onCache('weapon', function(value)
    if value and value ~= 0 then
        Theft:weaponThread()
    else
        Theft.hasWeapon = false
    end
end)

RegisterNetEvent('p_vehiclekeys/client/theft/useLockpick', function()
    if cache.vehicle and cache.vehicle ~= 0 then
        Theft:startHotwire()
    else
        local closestVeh, _ = lib.getClosestVehicle(GetEntityCoords(cache.ped), 4.0, true)
        if closestVeh and closestVeh ~= 0 then
            Theft:startLockpick(closestVeh)
        end
    end
end)

Theft.activeAlarms = {}

function Theft:stopAlarm(netId)
    self.activeAlarms[netId] = nil
    local entity = NetworkGetEntityFromNetworkId(netId)
    if entity and DoesEntityExist(entity) then
        SetVehicleAlarm(entity, false)
        SetVehicleIndicatorLights(entity, 0, false)
        SetVehicleIndicatorLights(entity, 1, false)
        SetVehicleLights(entity, 0)
    end
end

RegisterNetEvent('p_vehiclekeys/client/theft/triggerAlarm', function(netId, duration)
    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or not DoesEntityExist(entity) then return end

    Theft.activeAlarms[netId] = true
    local alarmEnd = GetGameTimer() + duration
    Citizen.CreateThread(function()
        local control = GetGameTimer() + 1000
        while not NetworkHasControlOfEntity(entity) and GetGameTimer() < control do
            NetworkRequestControlOfEntity(entity)
            Citizen.Wait(0)
        end

        SetVehicleAlarm(entity, true)
        StartVehicleAlarm(entity)

        local on = false
        local nextToggle = 0
        while Theft.activeAlarms[netId] and DoesEntityExist(entity) and GetGameTimer() < alarmEnd do
            if GetGameTimer() >= nextToggle then
                on = not on
                nextToggle = GetGameTimer() + 500
            end
            SetVehicleLights(entity, on and 2 or 1)
            SetVehicleIndicatorLights(entity, 0, on)
            SetVehicleIndicatorLights(entity, 1, on)
            Citizen.Wait(0)
        end

        Theft.activeAlarms[netId] = nil
        if DoesEntityExist(entity) then
            SetVehicleAlarm(entity, false)
            SetVehicleIndicatorLights(entity, 0, false)
            SetVehicleIndicatorLights(entity, 1, false)
            SetVehicleLights(entity, 0)
        end
    end)
end)

AddEventHandler('p_vehiclekeys/client/theft/stopAlarm', function(netId)
    Theft:stopAlarm(netId)
end)

return Theft
