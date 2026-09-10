--[[----------------------------------------------------------------------------
PRExportServiceProvider.lua
Publish service definition: connection settings, the token dialog, and the
upload loop (plan 18.13-18.18). Publish-only, JPEG sRGB.
------------------------------------------------------------------------------]]

local LrApplication = import 'LrApplication'
local LrDialogs = import 'LrDialogs'
local LrFileUtils = import 'LrFileUtils'
local LrPathUtils = import 'LrPathUtils'
local LrTasks = import 'LrTasks'
local LrView = import 'LrView'

require 'PRApi'
require 'PRPublishSupport'
local PRConfig = require 'PRConfig'

local bind = LrView.bind
local share = LrView.share

local exportServiceProvider = {}

exportServiceProvider.supportsIncrementalPublish = 'only'
exportServiceProvider.hideSections = { 'exportLocation', 'video' }
exportServiceProvider.allowFileFormats = { 'JPEG' }
exportServiceProvider.allowColorSpaces = { 'sRGB' }
exportServiceProvider.hidePrintResolution = true
exportServiceProvider.canExportVideo = false

local defaultSiteUrl = PRConfig.defaultSiteUrl
if defaultSiteUrl == '__SITE_URL__' then defaultSiteUrl = '' end

exportServiceProvider.exportPresetFields = {
	{ key = 'siteUrl', default = defaultSiteUrl },
	{ key = 'apiToken', default = '' },
	{ key = 'tagFavorites', default = true },
	{ key = 'favoriteKeyword', default = 'Client Favorite' },
	{ key = 'tagGalleryName', default = true },
}

function exportServiceProvider.startDialog( propertyTable )
	propertyTable.connectionStatus = 'Not tested yet'
end

--- Tests the token, and warns when the plugin is older than the API minimum (plan 18.20).
local function testConnection( propertyTable )
	propertyTable.connectionStatus = 'Testing…'
	LrTasks.startAsyncTask( function()
		local ok, res = pcall( PRApi.ping, propertyTable )
		if not ok then
			propertyTable.connectionStatus = 'Failed: ' .. tostring( res )
			return
		end
		local status = 'Connected to ' .. tostring( ( res.studio and res.studio.name ) or 'your site' )
		local minVersion = res.minPluginVersion
		if minVersion and minVersion > '1.0.0' then
			status = status .. ' — please update the plugin (server needs ' .. tostring( minVersion ) .. ').'
		end
		propertyTable.connectionStatus = status
	end )
end

function exportServiceProvider.sectionsForTopOfDialog( f, propertyTable )
	return {
		{
			title = 'Proofroom Galleries',
			synopsis = bind 'connectionStatus',
			f:row {
				spacing = f:label_spacing(),
				f:static_text { title = 'Site URL:', alignment = 'right', width = share 'prLabel' },
				f:edit_field { value = bind 'siteUrl', fill_horizontal = 1, immediate = true },
			},
			f:row {
				spacing = f:label_spacing(),
				f:static_text { title = 'API token:', alignment = 'right', width = share 'prLabel' },
				f:password_field { value = bind 'apiToken', fill_horizontal = 1, immediate = true },
				f:push_button { title = 'Test connection', action = function() testConnection( propertyTable ) end },
			},
			f:row {
				spacing = f:label_spacing(),
				f:static_text { title = '', width = share 'prLabel' },
				f:static_text { title = bind 'connectionStatus', fill_horizontal = 1 },
			},
			f:row {
				spacing = f:label_spacing(),
				f:static_text { title = '', width = share 'prLabel' },
				f:static_text {
					title = 'Create a token in your studio dashboard under Settings → Lightroom. Each published collection becomes one client gallery.',
					fill_horizontal = 1, height_in_lines = 2,
				},
			},
		},
		{
			title = 'Client favorites and keywords',
			synopsis = function( props )
				return props.tagFavorites and ( 'Tag favorites “' .. tostring( props.favoriteKeyword ) .. '”' ) or 'No favorite tag'
			end,
			f:row {
				f:checkbox { title = 'When a client marks a favorite, add this keyword to the photo:', value = bind 'tagFavorites' },
				f:edit_field { value = bind 'favoriteKeyword', width_in_chars = 18, enabled = bind 'tagFavorites' },
			},
			f:row {
				f:checkbox { title = 'Also keyword published photos with the gallery name', value = bind 'tagGalleryName' },
			},
			f:row {
				f:static_text {
					title = 'Favorites and notes refresh when you select a published photo (Library → Comments panel) or click the refresh arrows.',
					fill_horizontal = 1, height_in_lines = 2,
				},
			},
		},
	}
end

-- ------------------------------------------------------------ publishing

local function collectionSettings( info )
	if info.publishedCollection then
		local summary = info.publishedCollection:getCollectionInfoSummary()
		return ( summary and summary.collectionSettings ) or {}
	end
	return {}
end

--- Resolves or creates the gallery for this published collection.
local function ensureGallery( exportSettings, exportContext )
	local info = exportContext.publishedCollectionInfo
	if info.remoteId then return info.remoteId, info.remoteUrl, false end
	if info.isDefaultCollection or not info.publishedCollection then
		error( 'Create a Published Collection (right-click the service → Create Published Collection), choose the client, then publish.' )
	end

	local settings = collectionSettings( info )
	local clientId = settings.clientId
	if not clientId or clientId == '' then
		local name = ( settings.newClientName or '' ):gsub( '^%s+', '' ):gsub( '%s+$', '' )
		local email = ( settings.newClientEmail or '' ):gsub( '%s+', '' )
		if name == '' or email == '' then
			error( 'Edit this collection (right-click → Edit Collection) and choose a client or enter a new client name and email.' )
		end
		clientId = PRApi.createClient( exportSettings, name, email ).id
	end
	local gallery = PRApi.createGallery( exportSettings, clientId, info.name, settings.kind or 'proof' )
	return gallery.id, gallery.url, true
end

local function keywordGalleryName( name )
	local catalog = LrApplication.activeCatalog()
	local keyword
	pcall( function()
		catalog:withWriteAccessDo( 'Tag gallery name', function()
			keyword = catalog:createKeyword( name, {}, true, nil, true )
		end, { timeout = 15 } )
	end )
	return keyword
end

function exportServiceProvider.processRenderedPhotos( functionContext, exportContext )
	local exportSession = exportContext.exportSession
	local exportSettings = assert( exportContext.propertyTable )
	local nPhotos = exportSession:countRenditions()

	local progressScope = exportContext:configureProgress {
		title = nPhotos > 1 and string.format( 'Publishing %d photos', nPhotos ) or 'Publishing one photo',
	}

	local galleryId, galleryUrl, created = ensureGallery( exportSettings, exportContext )
	local info = exportContext.publishedCollectionInfo
	local settings = collectionSettings( info )
	local nameKeyword = exportSettings.tagGalleryName ~= false and keywordGalleryName( info.name ) or nil

	local uploaded, failed = 0, 0

	for i, rendition in exportContext:renditions { stopIfCanceled = true } do
		progressScope:setPortionComplete( ( i - 1 ) / nPhotos )
		local photo = rendition.photo
		if not rendition.wasSkipped then
			local success, pathOrMessage = rendition:waitForRender()
			progressScope:setPortionComplete( ( i - 0.5 ) / nPhotos )
			if progressScope:isCanceled() then break end

			if success then
				local lrPhotoId = photo:getRawMetadata( 'uuid' )
				local fileName = LrPathUtils.removeExtension( photo:getFormattedMetadata( 'fileName' ) or LrPathUtils.leafName( pathOrMessage ) ) .. '.jpg'
				local size = LrFileUtils.fileAttributes( pathOrMessage ).fileSize

				local ok, err = pcall( function()
					local begun = PRApi.beginUpload( exportSettings, galleryId, lrPhotoId, fileName, size )
					if not begun.duplicate then
						PRApi.uploadFile( begun.uploadUrl, exportSettings.apiToken, pathOrMessage )
					end
					rendition:recordPublishedPhotoId( begun.photoId )
					rendition:recordPublishedPhotoUrl( galleryUrl )
					if nameKeyword then pcall( function() photo:addKeyword( nameKeyword ) end ) end
				end )

				LrFileUtils.delete( pathOrMessage )
				if ok then uploaded = uploaded + 1 else failed = failed + 1; rendition:uploadFailed( tostring( err ) ) end
			else
				failed = failed + 1
				rendition:uploadFailed( tostring( pathOrMessage ) )
			end
		else
			rendition:recordPublishedPhotoId( rendition.publishedPhotoId )
		end
	end

	if created then exportSession:recordRemoteCollectionId( galleryId ) end
	exportSession:recordRemoteCollectionUrl( galleryUrl )

	if uploaded > 0 and settings.publishToClient then
		pcall( PRApi.publishGallery, exportSettings, galleryId )
	end

	progressScope:done()

	if created and uploaded > 0 then
		local ok, data = pcall( PRApi.getGallery, exportSettings, galleryId )
		if ok and data.gallery then
			local g = data.gallery
			LrDialogs.message( 'Gallery created: ' .. tostring( g.title ),
				string.format( 'Link: %s\nAccess code: %s\nStatus: %s\n\nOpen Studio → Galleries to send the link and code to %s.',
					tostring( g.url ), tostring( g.access_code or '—' ), tostring( g.status ), tostring( g.client and g.client.name or 'the client' ) ), 'info' )
		end
	elseif failed > 0 then
		LrDialogs.message( string.format( '%d photo(s) could not be published', failed ),
			'Check your site URL and API token in the publish service settings, then publish again. The plugin log is in Lightroom\'s Help → Log Files.', 'warning' )
	end
end

for key, value in pairs( PRPublishSupport ) do exportServiceProvider[ key ] = value end

return exportServiceProvider
