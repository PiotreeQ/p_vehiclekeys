fx_version 'cerulean'
game 'gta5'
author 'pScripts [tebex.pscripts.store]'
description 'Mantine Template'
lua54 'yes'
version '1.0.0'

ui_page 'web/build/index.html'

client_script "client/**/*"
server_script "server/**/*"

files {
	'web/build/index.html',
	'web/build/**/*',
  'locales/*.json'
}