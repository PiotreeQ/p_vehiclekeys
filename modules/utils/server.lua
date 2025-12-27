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

return Utils