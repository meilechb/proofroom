--[[----------------------------------------------------------------------------
PRInfoProvider.lua
Plugin Manager section: version, a short how-to, and an "Open studio" button
(plan 18.17). The site URL comes from the build-time config or the publish
service settings.
------------------------------------------------------------------------------]]

local LrHttp = import 'LrHttp'
local LrView = import 'LrView'

local PRConfig = require 'PRConfig'

local function studioUrl()
	local url = PRConfig.defaultSiteUrl
	if not url or url == '' or url == '__SITE_URL__' then return nil end
	return url:gsub( '/+$', '' ) .. '/studio'
end

local provider = {}

function provider.sectionsForTopOfDialog( f, propertyTable )
	local url = studioUrl()
	return {
		{
			title = 'Proofroom Galleries',
			f:static_text { title = 'Publish proofs and finals from Lightroom straight to your client galleries.', fill_horizontal = 1 },
			f:static_text { title = 'Set up: add a Publish Service (Publish Services panel → Proofroom Galleries), paste your API token from Studio → Settings → Lightroom, then create a Published Collection per client.', fill_horizontal = 1, height_in_lines = 3 },
			f:row {
				f:push_button {
					title = 'Open studio dashboard',
					enabled = url ~= nil,
					action = function() if url then LrHttp.openUrlInBrowser( url ) end end,
				},
			},
		},
	}
end

return provider
