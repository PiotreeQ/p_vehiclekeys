local Utils = {}

lib.locale(Bridge?.Config?.Language or 'en')
lib.versionCheck('PiotreeQ/p_vehiclekeys')

function Utils:trim(str)
    if type(str) ~= 'string' then return str end
    return str:match('^%s*(.-)%s*$')
end

return Utils
