local Locks = {}
local Utils = require 'modules.utils.server'

function Locks:toggleLock(playerId, netId, state, requireKey)
    local _source = playerId
    if requireKey then
        if not _source or _source < 1 then
            return
        end
    end

    if not netId or netId == 0 then
        return
    end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then
        return
    end

    if requireKey then
        local vehPlate = Utils:trim(GetVehicleNumberPlateText(entity))
        local itemCount = Bridge.Inventory.getItemCount(_source, 'car_key', {plate = vehPlate})
        if itemCount < 1 then
            return
        end
    end

    local ownerId = NetworkGetEntityOwner(entity)
    local coords = GetEntityCoords(entity)
    local players = lib.getNearbyPlayers(coords, 20.0)

    if playerId then
        print('Player ' .. playerId .. ' toggled lock for vehicle ' .. netId .. ' to state ' .. tostring(state))
        TriggerClientEvent('p_vehiclekeys/client/locks/toggle', playerId, netId, state, true)
    end
    
    if ownerId and (not playerId or ownerId ~= playerId) then
        TriggerClientEvent('p_vehiclekeys/client/locks/toggle', ownerId, netId, state)
    end

    for _, player in ipairs(players) do
        if player.id ~= ownerId then
            if playerId and player.id == playerId then
                goto skip
            end

            TriggerClientEvent('p_vehiclekeys/client/locks/toggle', player.id, netId, state)

            ::skip::
        end
    end
end

RegisterNetEvent('p_vehiclekeys/server/locks/toggle', function(netId, state)
    local _source = source
    Locks:toggleLock(_source, netId, state, true)
end)

exports('changeLockState', function(playerId, netId, state)
    -- if playerId is nil, script will not check for keys
    Locks:toggleLock(playerId, netId, state, playerId and true or false)
end)