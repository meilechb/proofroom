--[[----------------------------------------------------------------------------
Info.lua
Proofroom — Lightroom Classic publish service (placeholder name; see the rename
pass in the build plan). Publishes proofs and finals to the photographer's own
client galleries and pulls client favorites and notes back into Lightroom.

The site URL and API token are entered in the publish service settings. The zip
build script may stamp a default site URL into PRConfig.lua.
------------------------------------------------------------------------------]]

return {
	LrSdkVersion = 6.0,
	LrSdkMinimumVersion = 6.0,

	LrToolkitIdentifier = 'com.proofroom.lightroom.galleries',
	LrPluginName = 'Proofroom Galleries',
	LrPluginInfoUrl = 'https://proofroom.example/studio/settings/lightroom',

	LrExportServiceProvider = {
		title = 'Proofroom Galleries',
		file = 'PRExportServiceProvider.lua',
	},

	LrPluginInfoProvider = 'PRInfoProvider.lua',

	VERSION = { major = 1, minor = 0, revision = 0, build = 1 },
}
