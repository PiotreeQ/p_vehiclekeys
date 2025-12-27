local Config = {}

-- ## Set your Framework / Inventory / Language etc in p_bridge!

---@class Config.Settings
Config.Settings = {
    keepSteeringWheel = true, -- Whether to keep steering wheel position when exiting vehicle
    vehicleTiers = {
        ['low'] = {0, 1, 8, 11, 12, 13},
        ['medium'] = {2, 3, 4, 9, 10, 14, 20, 21, 22},
        ['high'] = {5, 6, 7, 15, 16, 17, 18, 19}
    }
}

---@class Config.Locks
---@field carEffect: boolean Whether to play car effect when locking/unlocking.
---@field playAnimation: 'simple' | 'advanced' | false [The type of animation, advanced = with prop, simple = without, false = no animation]
---@field keyBind: string | false [The key bind to toggle vehicle locks. Set to false to disable key bind.]
---@field requireClosedDoors: boolean Whether to require vehicle doors to be closed before locking.
---@field canToggle: fun():boolean A function that returns whether the player can toggle vehicle locks (not dead, cuffed, etc).
---@field ignoreBikes: boolean [true = bikes are always unlocked, false = bikes can be locked]
---@field lockNpcVehicles: boolean Whether NPC vehicles can be locked/unlocked.
Config.Locks = {
    carEffect = true,
    playAnimation = 'advanced',
    keyBind = 'U', -- Remember to clear cache or change keybinds in settings if you change this!
    requireClosedDoors = true,
    canToggle = function()
        local playerState = LocalPlayer.state
        local stateBags = {'isDead', 'isCuffed', 'dead', 'inLastStand'}
        for _, state in ipairs(stateBags) do
            if playerState[state] then
                return false
            end
        end

        return true
    end,
    ignoreBikes = true,
    lockNpcVehicles = true
}

---@class Config.Engine
---@field preventDisable: boolean Whether to prevent engine from being disabled when its running
---@field keyBind: string | false [The key bind to toggle vehicle engine. Set to false to disable key bind.]
---@field ignoreBikes: boolean [true = auto start bike, false = requires key to start bike]
Config.Engine = {
    preventDisable = true,
    keyBind = 'Y', -- Remember to clear cache or change keybinds in settings if you change this!
    ignoreBikes = true,
}

---@class Config.Theft
---@field enabled: boolean Whether to enable vehicle theft/lockpicking system.
---@field requiredItem: string The item required to lockpick vehicles.
---@field removeItemOnFail: boolean Whether to remove the lockpick item when it breaks.
---@field cooldown: number Cooldown between lockpick attempts in milliseconds.
---@field alertPolice: boolean Whether to alert police on failed attempts.
---@field policeAlertChance: number Chance (0-100) to alert police on failure.
---@field difficulties: table Difficulty settings for each level.
Config.Theft = {
    enabled = true,
    requiredItem = 'lockpick',
    removeItemOnFail = true,
    cooldown = 5000,
    alertPolice = true,
    policeAlertChance = 50,
    difficulties = {
        easy = {
            pins = 3,
            timeLimit = 45000,
            tolerance = 15,
        },
        medium = {
            pins = 4,
            timeLimit = 35000,
            tolerance = 10,
        },
        hard = {
            pins = 5,
            timeLimit = 25000,
            tolerance = 6,
        },
        expert = {
            pins = 6,
            timeLimit = 20000,
            tolerance = 4,
        }
    },
    
    -- Hotwire time limits per difficulty
    hotwireTimes = {
        easy = 35000,
        medium = 28000,
        hard = 22000,
        expert = 18000
    },
    
    -- Vehicle class to difficulty mapping
    -- 0=Compacts, 1=Sedans, 2=SUVs, 3=Coupes, 4=Muscle, 5=Sports Classics
    -- 6=Sports, 7=Super, 8=Motorcycles, 9=Off-road, 10=Industrial
    -- 11=Utility, 12=Vans, 13=Cycles, 14=Boats, 15=Helicopters
    -- 16=Planes, 17=Service, 18=Emergency, 19=Military, 20=Commercial, 21=Trains
    vehicleClassDifficulty = {
        [0] = 'easy',      -- Compacts
        [1] = 'easy',      -- Sedans
        [2] = 'medium',    -- SUVs
        [3] = 'medium',    -- Coupes
        [4] = 'medium',    -- Muscle
        [5] = 'hard',      -- Sports Classics
        [6] = 'hard',      -- Sports
        [7] = 'expert',    -- Super
        [8] = 'easy',      -- Motorcycles
        [9] = 'medium',    -- Off-road
        [10] = 'hard',     -- Industrial
        [11] = 'medium',   -- Utility
        [12] = 'easy',     -- Vans
        [13] = 'easy',     -- Cycles
        [14] = 'easy',     -- Boats
        [15] = 'hard',     -- Helicopters
        [16] = 'expert',   -- Planes
        [17] = 'hard',     -- Service
        [18] = 'expert',   -- Emergency
        [19] = 'expert',   -- Military
        [20] = 'hard',     -- Commercial
        [21] = 'easy',     -- Trains
    },
    
    -- Blacklisted vehicle models (cannot be lockpicked)
    blacklistedModels = {
        -- Add vehicle model hashes or names here
        -- Example: 'police', 'police2', 'police3'
    },
    
    -- Can the player attempt to lockpick? (additional checks)
    canAttempt = function(vehicle)
        local playerState = LocalPlayer.state
        local stateBags = {'isDead', 'isCuffed', 'dead', 'inLastStand'}
        for _, state in ipairs(stateBags) do
            if playerState[state] then
                return false
            end
        end
        return true
    end
}

return Config