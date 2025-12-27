local Keys = {}
local Utils = require 'modules.utils.client'

function Keys:createKey(plate, entity)
    if not plate or plate == '' then
        return
    end
    
    if not entity or entity == 0 or not NetworkGetEntityIsNetworked(entity) then
        return
    end

    local netId = NetworkGetNetworkIdFromEntity(entity)
    TriggerServerEvent('p_vehiclekeys/createKey', plate, netId)
end

function Keys:removeKey(plate, entity, removeAll)
    if not plate or plate == '' then
        return
    end
    
    if not entity or entity == 0 or not NetworkGetEntityIsNetworked(entity) then
        return
    end

    local netId = NetworkGetNetworkIdFromEntity(entity)
    TriggerServerEvent('p_vehiclekeys/removeKey', plate, netId, removeAll)
end

exports('createKey', function(plate, entity)
    Keys:createKey(plate, entity)
end)

exports('removeKey', function(plate, entity, removeAll)
    Keys:removeKey(plate, entity, removeAll)
end)

if true then -- enable debug mode in p_bridge config if you want to use it
    lib.print.info('[Keys] Module loaded')
    RegisterCommand('spawnKeys', function()
        if not cache.vehicle or cache.vehicle == 0 then
            return lib.print.info('You must be in a vehicle to spawn keys')
        end

        local plate = Utils:trim(GetVehicleNumberPlateText(cache.vehicle))
        Keys:createKey(plate, cache.vehicle)
    end, false)
end