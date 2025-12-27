fx_version 'cerulean'
game 'gta5'
author 'pScripts [tebex.pscripts.store / discord.gg/piotreqscripts]'
description 'Multi-Framework Advanced Vehicle Keys System'
lua54 'yes'
version '1.0.0'

ui_page 'web/build/index.html'

client_scripts {
	'modules/**/client.lua',
}

server_scripts {
	'@oxmysql/lib/MySQL.lua',
	'modules/**/server.lua',
}

shared_scripts {
	'@ox_lib/init.lua',
	'@p_bridge/imports.lua',
	'config/shared.lua',
}

dependencies {
	'ox_lib',
	'p_bridge'
}

files {
	'web/build/index.html',
	'web/build/**/*',
  	'locales/*.json',
	'config/shared.lua',
	'modules/**/client.lua',
	'modules/**/server.lua',
}