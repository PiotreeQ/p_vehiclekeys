local Keys = {}
local Utils = require 'modules.utils.client'

local function getVehicleNetId(plate, entity)
    if not plate or plate == '' then return end
    if not entity or entity == 0 or not NetworkGetEntityIsNetworked(entity) then return end
    return NetworkGetNetworkIdFromEntity(entity)
end

function Keys:createKey(plate, entity)
    local netId = getVehicleNetId(plate, entity)
    if not netId then return end
    TriggerServerEvent('p_vehiclekeys/createKey', plate, netId)
end

-- Removal only needs the plate; the vehicle entity is intentionally ignored so
-- keys can be removed even when the vehicle is gone or out of range.
function Keys:removeKey(plate, _entity, removeAll)
    plate = plate and Utils:trim(plate) or ''
    if plate == '' then return end
    TriggerServerEvent('p_vehiclekeys/removeKey', plate, removeAll)
end

exports('createKey', function(plate, entity)
    Keys:createKey(plate, entity)
end)

exports('removeKey', function(plate, entity, removeAll)
    Keys:removeKey(plate, entity, removeAll)
end)

if true then
    RegisterCommand('spawnKeys', function()
        if not cache.vehicle or cache.vehicle == 0 then
            return lib.print.info('You must be in a vehicle to spawn keys')
        end

        Keys:createKey(Utils:trim(GetVehicleNumberPlateText(cache.vehicle)), cache.vehicle)
    end, false)
end

Citizen.CreateThread(function()
    Citizen.Wait(3000)
    if GetResourceState('ox_inventory') == 'started' then
        exports['ox_inventory']:displayMetadata({
            plate = locale('plate'),
        })
    end

    if GetResourceState('tgiann-inventory') == 'started' then
        exports['tgiann-inventory']:DisplayMetadata({
            plate = locale('plate'),
        })
    end
end)

return Keys
