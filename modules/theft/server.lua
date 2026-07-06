local Theft = {}
local Config = require 'config.shared'
local Utils = require 'modules.utils.server'
local SECURITY_TIER_KEY = 'p_vehiclekeys:securityTier'

local function initializeDatabase()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS vehicle_security_tiers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            plate VARCHAR(20) NOT NULL UNIQUE,
            security_tier INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_security_tier (security_tier)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
end

local function getVehicleSecurityTierDB(plate)
    return MySQL.scalar.await('SELECT security_tier FROM vehicle_security_tiers WHERE plate = ?', {plate}) or 1
end

local function setVehicleSecurityTierDB(plate, tier)
    MySQL.insert.await(
        'INSERT INTO vehicle_security_tiers (plate, security_tier) VALUES (?, ?) ON DUPLICATE KEY UPDATE security_tier = VALUES(security_tier)',
        {plate, tier}
    )
end

local function getValidatedVehicle(playerId, netId, maxDistance)
    if not netId or netId == 0 then return end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then return end

    local plyCoords = GetEntityCoords(GetPlayerPed(playerId))
    if #(plyCoords - GetEntityCoords(entity)) > maxDistance then return end

    return entity
end

RegisterNetEvent('p_vehiclekeys/server/theft/unlock', function(netId)
    local _source = source
    local entity = getValidatedVehicle(_source, netId, 5.0)
    if not entity then return end

    local players = lib.getNearbyPlayers(GetEntityCoords(entity), 50.0)
    for _, player in ipairs(players) do
        TriggerClientEvent('p_vehiclekeys/client/locks/toggle', player.id, netId, true)
    end
end)

local function findKeyOwner(plate)
    for _, playerId in ipairs(GetPlayers()) do
        playerId = tonumber(playerId)
        if Bridge.Inventory.getItemCount(playerId, 'car_key', {plate = plate}) >= 1 then
            return playerId
        end
    end
end

RegisterNetEvent('p_vehiclekeys/server/theft/triggerAlarm', function(netId, reason)
    local _source = source
    if not Config.Theft.alarm or not Config.Theft.alarm.enabled then return end

    local entity = getValidatedVehicle(_source, netId, 10.0)
    if not entity then return end

    local entityOwner = NetworkGetEntityOwner(entity)
    if entityOwner and entityOwner > 0 then
        TriggerClientEvent('p_vehiclekeys/client/theft/triggerAlarm', entityOwner, netId, Config.Theft.alarm.duration)
    end

    if Config.Theft.alarm.notifyOwner then
        local plate = Utils:trim(GetVehicleNumberPlateText(entity))
        local keyOwnerId = findKeyOwner(plate)
        if keyOwnerId and keyOwnerId ~= _source then
            local localeKey = reason == 'start' and 'alarm_owner_start_notify' or 'alarm_owner_fail_notify'
            Bridge.Notify.showNotify(keyOwnerId, locale(localeKey), 'error')
        end
    end
end)

RegisterNetEvent('p_vehiclekeys/server/theft/upgradeSecurity', function(netId)
    local _source = source
    if not Config.SecurityUpgrade.enabled then return end

    local entity = getValidatedVehicle(_source, netId, 5.0)
    if not entity then return end

    local job = Bridge.Framework.getPlayerJob(_source)
    local jobName = type(job) == 'table' and job.name or job
    if not lib.table.contains(Config.SecurityUpgrade.requiredJob, jobName) then
        return Bridge.Notify.showNotify(_source, locale('upgrade_wrong_job'), 'error')
    end

    local plate = Utils:trim(GetVehicleNumberPlateText(entity))
    local currentTier = Entity(entity).state[SECURITY_TIER_KEY] or getVehicleSecurityTierDB(plate)
    local nextTier = currentTier + 1
    local upgradeConfig = Config.SecurityUpgrade.upgrades[nextTier]
    if not upgradeConfig then
        return Bridge.Notify.showNotify(_source, locale('upgrade_already_maxed'), 'error')
    end

    if Bridge.Inventory.getItemCount(_source, upgradeConfig.requiredItem) < upgradeConfig.itemCount then
        return Bridge.Notify.showNotify(_source, locale('upgrade_failed'), 'error')
    end

    Bridge.Inventory.removeItem(_source, upgradeConfig.requiredItem, upgradeConfig.itemCount)
    setVehicleSecurityTierDB(plate, nextTier)
    Entity(entity).state:set(SECURITY_TIER_KEY, nextTier, true)

    Bridge.Notify.showNotify(_source, locale('upgrade_success'), 'success')
end)

function Theft:getVehicleSecurityTier(entity)
    if not entity or entity == 0 then
        return 1
    end

    return Entity(entity).state[SECURITY_TIER_KEY] or 1
end

lib.callback.register('p_vehiclekeys:getVehicleSecurityTier', function(source, plate)
    return getVehicleSecurityTierDB(plate)
end)

Citizen.CreateThread(function()
    if Config.Theft.enabled then
        while not Bridge?.Framework?.registerItem do
            Citizen.Wait(100)
        end
        
        Bridge.Framework.registerItem(Config.Theft.requiredItem, function(source)
            TriggerClientEvent('p_vehiclekeys/client/theft/useLockpick', source)
        end)
    end
end)

initializeDatabase()

return Theft
