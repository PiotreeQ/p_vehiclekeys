local Utils = {}

lib.locale(Bridge?.Config?.Language or 'en')

function Utils:exportHandler(resourceName, exportName, func)
    AddEventHandler(('__cfx_export_%s_%s'):format(resourceName, exportName), function(setCB)
        setCB(func)
    end)
end

function Utils:trim(str)
    if not str or type(str) ~= 'string' then return str end
    return str:match('^%s*(.-)%s*$')
end

function Utils:getVehicleByPlate(plate)
    if not plate or plate == '' then
        return nil
    end

    local vehicles = lib.getNearbyVehicles(GetEntityCoords(cache.ped), 25.0, true)
    for k, v in ipairs(vehicles) do
        local vehPlate = Utils:trim(GetVehicleNumberPlateText(v.vehicle))
        if vehPlate == plate then
            return v.vehicle
        end
    end

    return nil
end

function Utils:toggleTrunk(vehicle)
    local doorRatio = GetVehicleDoorAngleRatio(vehicle, 5)
    if doorRatio > 0.0 then
        SetVehicleDoorShut(vehicle, 5, false)
    else
        SetVehicleDoorOpen(vehicle, 5, false, false)
    end
end

return Utils