local Theft = {}
local Utils = require 'modules.utils.server'

-- Server event to unlock vehicle after successful lockpick
RegisterNetEvent('p_vehiclekeys/server/theft/unlock', function(netId)
    local _source = source
    
    if not netId or netId == 0 then
        return
    end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 then
        return
    end

    -- Verify player is near the vehicle
    local playerPed = GetPlayerPed(_source)
    local playerCoords = GetEntityCoords(playerPed)
    local vehicleCoords = GetEntityCoords(entity)
    
    if #(playerCoords - vehicleCoords) > 5.0 then
        return -- Player too far from vehicle
    end

    -- Unlock the vehicle for all nearby players
    local players = lib.getNearbyPlayers(vehicleCoords, 50.0)
    
    for _, player in ipairs(players) do
        TriggerClientEvent('p_vehiclekeys/client/locks/toggle', player.id, netId, true)
    end
    
    -- Also trigger for the source player
    TriggerClientEvent('p_vehiclekeys/client/locks/toggle', _source, netId, true)
    
    -- Log the theft attempt (optional)
    local vehPlate = Utils:trim(GetVehicleNumberPlateText(entity))
    print(string.format('[p_vehiclekeys] Player %s (%s) successfully lockpicked vehicle with plate: %s', 
        GetPlayerName(_source), _source, vehPlate))
end)

-- Server event to remove lockpick on failure
RegisterNetEvent('p_vehiclekeys/server/theft/removeLockpick', function()
    local _source = source
    
    -- Remove lockpick item from player inventory
    Bridge.Inventory.removeItem(_source, 'lockpick', 1)
end)

-- Server event to alert police
RegisterNetEvent('p_vehiclekeys/server/theft/alertPolice', function(coords)
    local _source = source
    
    -- Verify coords are valid
    if not coords or type(coords) ~= 'vector3' then
        local playerPed = GetPlayerPed(_source)
        coords = GetEntityCoords(playerPed)
    end
    
    -- Get street name for dispatch
    local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    local streetName = GetStreetNameFromHashKey(streetHash)
    
    -- Trigger dispatch event (compatible with various dispatch systems)
    -- ps-dispatch
    if GetResourceState('ps-dispatch') == 'started' then
        TriggerClientEvent('ps-dispatch:client:VehicleTheft', -1, coords)
    end
    
    -- cd_dispatch
    if GetResourceState('cd_dispatch') == 'started' then
        TriggerEvent('cd_dispatch:AddNotification', {
            job_table = {'police', 'sheriff'},
            coords = coords,
            title = 'Vehicle Theft',
            message = 'Attempted vehicle break-in at ' .. streetName,
            flash = 1,
            unique_id = tostring(math.random(0, 99999)),
            sound = 1,
            blip = {
                sprite = 595,
                scale = 1.2,
                colour = 1,
                flashes = true,
                text = 'Vehicle Theft',
                time = 5,
                radius = 0,
            }
        })
    end
    
    -- qs-dispatch
    if GetResourceState('qs-dispatch') == 'started' then
        TriggerEvent('qs-dispatch:server:CreateDispatch', {
            job = {'police'},
            callLocation = coords,
            message = 'Vehicle Theft in Progress',
            flashes = true,
            sprite = 595,
            color = 1,
            scale = 1.2,
            length = 3,
        })
    end
    
    -- Generic alert for police job (works with most frameworks)
    local players = GetPlayers()
    for _, playerId in ipairs(players) do
        local playerJob = Bridge.Framework.getJob(playerId)
        if playerJob and (playerJob.name == 'police' or playerJob.name == 'sheriff' or playerJob.name == 'lspd') then
            TriggerClientEvent('p_vehiclekeys/client/theft/policeAlert', playerId, coords, streetName)
        end
    end
    
    print(string.format('[p_vehiclekeys] Vehicle theft alert triggered at %s by player %s', streetName, _source))
end)

return Theft