local Keys = {}
local Utils = require 'modules.utils.server'

local function validateVehicle(playerId, plate, netId, action)
    if not playerId or playerId < 1 then
        return lib.print.error(('[%s] Invalid player ID provided'):format(action), playerId)
    end

    if not plate or plate == '' then
        return lib.print.error(('[%s] Invalid plate provided'):format(action), playerId)
    end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then
        return
    end

    local plyCoords = GetEntityCoords(GetPlayerPed(playerId))
    if #(plyCoords - GetEntityCoords(entity)) > 50.0 then
        return
    end

    plate = Utils:trim(plate)
    local vehiclePlate = Utils:trim(GetVehicleNumberPlateText(entity))
    if plate ~= vehiclePlate then
        if Bridge?.Config?.Debug then
            lib.print.error(('[%s] Plate mismatch: provided %s, vehicle plate %s'):format(action, plate, vehiclePlate), playerId)
        end
        return
    end

    return plate
end

function Keys:createKey(playerId, plate, netId)
    plate = validateVehicle(playerId, plate, netId, 'createKey')
    if not plate then return end

    Bridge.Inventory.addItem(playerId, 'car_key', 1, { plate = plate })
end

function Keys:removeKey(playerId, plate, netId, removeAll)
    plate = validateVehicle(playerId, plate, netId, 'removeKey')
    if not plate then return end

    local removeCount = removeAll and Bridge.Inventory.getItemCount(playerId, 'car_key', { plate = plate }) or 1
    Bridge.Inventory.removeItem(playerId, 'car_key', removeCount, { plate = plate })
end

RegisterNetEvent('p_vehiclekeys/createKey', function(plate, netId)
    Keys:createKey(source, plate, netId)
end)

RegisterNetEvent('p_vehiclekeys/removeKey', function(plate, netId, removeAll)
    Keys:removeKey(source, plate, netId, removeAll)
end)

Citizen.CreateThread(function()
    while not Bridge?.Framework?.registerItem do
        Citizen.Wait(100)
    end

    Bridge.Framework.registerItem('car_key', function(source, item)
        local metadata = type(item) == 'table' and (item.metadata or item.info) or nil
        local plate = metadata and metadata.plate
        if not plate or plate == '' then
            if Bridge?.Config?.Debug then
                lib.print.error('[car_key] No plate metadata on used item', source)
            end
            return
        end

        TriggerClientEvent('p_vehiclekeys/client/keys/useCarKey', source, Utils:trim(plate))
    end)
end)

return Keys
