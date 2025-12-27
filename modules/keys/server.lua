local Keys = {}
local Utils = require 'modules.utils.server'

function Keys:createKey(playerId, plate, netId)
    local _source = playerId
    if not _source or _source < 1 then
        return lib.print.error('[createKey] Invalid player ID provided', _source)
    end

    if not plate or plate == '' then
        return lib.print.error('[createKey] Invalid plate provided', _source)
    end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then
        return
    end
    
    plate = Utils:trim(plate)
    local vehiclePlate = Utils:trim(GetVehicleNumberPlateText(entity))
    if plate ~= vehiclePlate then
        if Bridge?.Config?.Debug then
            lib.print.error(('[createKey] Plate mismatch: provided %s, vehicle plate %s'):format(plate, vehiclePlate), _source)
        end
        return
    end

    Bridge.Inventory.addItem(_source, 'car_key', 1, {
        plate = plate
    })
end

RegisterNetEvent('p_vehiclekeys/createKey', function(plate, netId)
    local _source = source
    Keys:createKey(_source, plate, netId)
end)

function Keys:removeKey(playerId, plate, netId, removeAll)
    local _source = playerId
    if not _source or _source < 1 then
        return lib.print.error('[removeKey] Invalid player ID provided', _source)
    end

    if not plate or plate == '' then
        return lib.print.error('[removeKey] Invalid plate provided', _source)
    end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then
        return
    end

    plate = Utils:trim(plate)
    local vehiclePlate = Utils:trim(GetVehicleNumberPlateText(entity))
    if plate ~= vehiclePlate then
        if Bridge?.Config?.Debug then
            lib.print.error(('[removeKey] Plate mismatch: provided %s, vehicle plate %s'):format(plate, vehiclePlate), _source)
        end
        return
    end

    local removeCount = removeAll and Bridge.Inventory.getItemCount(_source, 'car_key', { plate = plate }) or 1
    Bridge.Inventory.removeItem(_source, 'car_key', removeCount, {
        plate = plate
    })
end

RegisterNetEvent('p_vehiclekeys/removeKey', function(plate, netId, removeAll)
    local _source = source
    Keys:removeKey(_source, plate, netId, removeAll)
end)