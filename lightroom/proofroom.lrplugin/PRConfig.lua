--[[----------------------------------------------------------------------------
PRConfig.lua
Build-time configuration (plan 18.12). The zip build script replaces
DEFAULT_SITE_URL with the studio's site URL so the plugin ships pre-pointed at
the right host; the photographer can still change it in the service settings.
------------------------------------------------------------------------------]]

return {
	-- Replaced by scripts/build-plugin.mjs at package time. Left blank in source.
	defaultSiteUrl = '__SITE_URL__',
	minPluginVersion = '1.0.0',
}
