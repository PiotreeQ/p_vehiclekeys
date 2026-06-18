# p_vehiclekeys

<img width="1920" height="1080" alt="thumbnail_yt" src="https://github.com/user-attachments/assets/7b7812cb-556d-4f53-8332-482159686969" />

### [More Scripts can be found here!](https://pscripts-store.com/)

## Preview

https://www.youtube.com/watch?v=_lzPeKR4q4w

## What is this resource?

This is a multi-framework Advanced Vehicle Keys System for FiveM. Handles locking/unlocking, engine control, theft mechanics, and security upgrades.
> Stop overpaying. Premium keys scripts charge $20-40 for less. This resource is free, open, and built better - multi-framework, actively maintained, and packed with features others lock behind a paywall.

## Features

- Vehicle Keys: Item-based keys tied to plate metadata; exports for createKey / removeKey / hasKey
- NPC Vehicle Theft: You can stole a vehicle from NPC by aiming at the driver with weapon
- Lock / Unlock: Press U to lock/unlock within 15m; animation, horn, indicators; NPC vehicle locking; police/mechanic unlock tool
- Engine Control: Press Y to toggle engine; blocks starting without a key; preserves steering wheel angle on exit
- Lockpick Minigame: 4 difficulty tiers (3–6 pins, 20–45s), scales by vehicle class; optional lockpick durability
- Hotwire Minigame: Difficulty-scaled hotwire sequence; auto-starts engine on success
- Signal Jammer Minigame: Required for Expert-tier vehicles; frequency/amplitude matching challenge
- Police Alerts: Configurable chance to alert dispatch on failed theft attempt
- Security Tier Upgrades: Mechanics install better security to harden vehicles against theft (stored in MySQL)
- Car Key UI: Remote lock, trunk, engine, lights, horn, find vehicle, upgrade security; built with React + Mantine
- Backward Compatibility: Drop-in replacement for qb-vehiclekeys, qbx_vehiclekeys, Renewed-Vehiclekeys, MrNewbVehicleKeys, qs-vehiclekeys, p_carkeys

## Requirements

- [p_bridge](https://github.com/PiotreeQ/p_bridge) (Required)
- [ox_lib](https://github.com/overextended/ox_lib/releases/) (Required)
- ESX, QBCore, Qbox - Any of these framework (custom framework can be added into bridge)

## Installation

*SQL installation is automatically*
1. Download main release and unzip p_vehiclekeys folder into resources folder
2. Ensure p_vehiclekeys after p_bridge and ox_lib
3. Go to INSTALL folder and add items into your inventory
4. Restart the server

## Documentation

https://piotreq-scripts.gitbook.io/piotreq-scripts

## Need Support?

[Click here for support!](https://discord.gg/piotreqscripts)
