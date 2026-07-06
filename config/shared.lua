local Config = {}

-- ## Set your Framework / Inventory / Language etc in p_bridge!
-- Download it here: https://github.com/PiotreeQ/p_bridge
-- You can use /spawnKeys command to test key spawning (must be in a vehicle and Config.Debug must be true in p_bridge config)

---@class Config.Settings
---@field keepSteeringWheel: boolean Whether to keep steering wheel position when exiting vehicle
Config.Settings = {
    keepSteeringWheel = true, -- Whether to keep steering wheel position when exiting vehicle
}

---@class Config.Locks
---@field carEffect: boolean Whether to play car effect when locking/unlocking.
---@field playAnimation: 'simple' | 'advanced' | false [The type of animation, advanced = with prop, simple = without, false = no animation]
---@field keyBind: string | false [The key bind to toggle vehicle locks. Set to false to disable key bind.]
---@field requireClosedDoors: boolean Whether to require vehicle doors to be closed before locking.
---@field canToggle: fun():boolean A function that returns whether the player can toggle vehicle locks (not dead, cuffed, etc).
---@field ignoreBikes: boolean [true = bikes are always unlocked, false = bikes can be locked]
---@field lockNpcVehicles: boolean Lock unowned street vehicles currently driven by an NPC (player must lockpick to get in).
---@field lockParkedVehicles: boolean Lock unowned parked/empty street vehicles (player must lockpick to get in).
---@field unlockToolJobs: table A list of jobs that can unlock vehicles without keys (e.g., police, mechanic).
----@field findVehicleBlip: boolean Whether to create a blip on the map for the vehicle when using the find vehicle feature.
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
    lockNpcVehicles = true,
    lockParkedVehicles = true,
    unlockToolJobs = {'mechanic', 'police'},
    findVehicleBlip = true
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
    alarm = {
        enabled = true,
        -- Trigger vehicle alarm on failed minigame
        onFail = {
            lockpick = true,
            hotwire = true,
            jammer = true,
        },
        -- Security tier at which alarm also triggers when the minigame starts (0 = always, 2 = tier 2+, etc.)
        onStartMinTier = 2,
        -- Notify online key owner when alarm fires
        notifyOwner = true,
        -- How long the alarm plays in ms
        duration = 30000,
    },
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
        [11] = 'medium',   -- `Utility
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
        ['police'] = true,
        ['police2'] = true,
        ['police3'] = true,
        ['police4'] = true,
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

---@class Config.Compat
---@field enabled: boolean Provide drop-in exports/events for other vehicle key resources (qb-vehiclekeys, qbx_vehiclekeys, Renewed-Vehiclekeys, MrNewbVehicleKeys, qs-vehiclekeys, p_carkeys). Scripts calling those exports will be redirected to p_vehiclekeys. Shims are skipped for any of those resources that is actually running.
Config.Compat = {
    enabled = true,
}

---@class Config.SecurityUpgrade
---@field enabled: boolean Whether to enable vehicle security tier upgrade system
---@field requiredJob: string The job required to upgrade security
---@field upgrades: table Configuration for each security tier upgrade
Config.SecurityUpgrade = {
    enabled = true,
    requiredJob = {'mechanic'}, -- Job required to upgrade security
    upgrades = {
        -- Tier 1: Basic Security (default tier)
        [1] = {
            label = 'Basic Security',
            requiredItem = 'security_chip_1',
            itemCount = 1,
            duration = 30000, -- 30 seconds
            nextTier = 2,
        },
        -- Tier 2: Advanced Security
        [2] = {
            label = 'Advanced Security',
            requiredItem = 'security_chip_2',
            itemCount = 1,
            duration = 35000, -- 35 seconds
            nextTier = 3,
        },
        -- Tier 3: Expert Security
        [3] = {
            label = 'Expert Security',
            requiredItem = 'security_chip_3',
            itemCount = 1,
            duration = 40000, -- 40 seconds
            nextTier = nil, -- No upgrade after this tier
        },
    }
}

return Config