--[[----------------------------------------------------------------------------
PRPublishSupport.lua
Publish-specific hooks: collection settings (client + gallery type), favorites
and comments sync back into Lightroom, deletes, and "Open gallery" links
(plan 18.13-18.17). Comments are read-only in Lightroom (replies happen in the
studio dashboard).
------------------------------------------------------------------------------]]

local LrApplication = import 'LrApplication'
local LrBinding = import 'LrBinding'
local LrColor = import 'LrColor'
local LrDialogs = import 'LrDialogs'
local LrHttp = import 'LrHttp'
local LrTasks = import 'LrTasks'
local LrView = import 'LrView'

require 'PRApi'

local bind = LrView.bind

local publishServiceProvider = {}

publishServiceProvider.titleForPublishedCollection = 'Gallery'
publishServiceProvider.titleForPublishedCollection_standalone = 'Gallery'
publishServiceProvider.titleForGoToPublishedCollection = 'Open gallery in browser'
publishServiceProvider.titleForGoToPublishedPhoto = 'Open gallery in browser'
publishServiceProvider.titleForPhotoRating = 'Client favorite'
publishServiceProvider.supportsCustomSortOrder = false

function publishServiceProvider.getCollectionBehaviorInfo( publishSettings )
	return {
		defaultCollectionName = 'Unassigned (edit to choose a client)',
		defaultCollectionCanBeDeleted = true,
		canAddCollection = true,
		maxCollectionSetDepth = 0,
	}
end

-- ----------------------------------------------------- collection settings

local function clientItemsFrom( clients )
	local items = { { title = 'New client (fill in name and email below)', value = '' } }
	for _, c in ipairs( clients ) do
		items[ #items + 1 ] = { title = string.format( '%s  (%s)', c.name or '?', c.email or '' ), value = c.id }
	end
	return items
end

function publishServiceProvider.viewForCollectionSettings( f, publishSettings, info )
	local settings = info.collectionSettings
	if settings.kind == nil then settings.kind = 'proof' end
	if settings.clientId == nil then settings.clientId = '' end
	if settings.publishToClient == nil then settings.publishToClient = false end
	settings.clientItems = { { title = 'Loading clients…', value = settings.clientId } }
	settings.clientsStatus = ''

	LrTasks.startAsyncTask( function()
		local ok, clients = pcall( PRApi.listClients, publishSettings )
		if ok then
			settings.clientItems = clientItemsFrom( clients )
			settings.clientsStatus = string.format( '%d client(s) on your site', #clients )
		else
			settings.clientItems = { { title = 'New client (fill in name and email below)', value = '' } }
			settings.clientsStatus = tostring( clients )
		end
	end )

	local linked = info.publishedCollection and info.publishedCollection:getRemoteId()

	return f:group_box {
		title = 'Client gallery',
		fill_horizontal = 1,
		spacing = f:control_spacing(),
		bind_to_object = settings,
		f:row {
			f:static_text { title = 'Client:', width = 110, alignment = 'right' },
			f:popup_menu { value = bind 'clientId', items = bind 'clientItems', fill_horizontal = 1, enabled = not linked },
		},
		f:row {
			f:static_text { title = '', width = 110 },
			f:static_text { title = bind 'clientsStatus', text_color = LrColor( 0.4, 0.4, 0.4 ), fill_horizontal = 1 },
		},
		f:row {
			f:static_text { title = 'New client name:', width = 110, alignment = 'right' },
			f:edit_field { value = bind 'newClientName', fill_horizontal = 1, enabled = LrBinding.keyEquals( 'clientId', '' ) },
		},
		f:row {
			f:static_text { title = 'New client email:', width = 110, alignment = 'right' },
			f:edit_field { value = bind 'newClientEmail', fill_horizontal = 1, enabled = LrBinding.keyEquals( 'clientId', '' ) },
		},
		f:row {
			f:static_text { title = 'Gallery type:', width = 110, alignment = 'right' },
			f:popup_menu {
				value = bind 'kind',
				enabled = not linked,
				items = {
					{ title = 'Proofs — client marks favorites and leaves notes', value = 'proof' },
					{ title = 'Finals — downloads enabled', value = 'final' },
				},
			},
		},
		f:row {
			f:static_text { title = '', width = 110 },
			f:checkbox { title = 'Make the gallery visible to the client as soon as photos are published', value = bind 'publishToClient' },
		},
		f:row {
			f:static_text { title = '', width = 110 },
			f:static_text {
				title = linked and 'This collection is linked to a gallery on your site.'
					or 'The gallery, its link and access code are created on first publish. The collection name becomes the gallery title.',
				fill_horizontal = 1, height_in_lines = 2,
			},
		},
	}
end

-- --------------------------------------------------------------- feedback

local function loadFeedback( publishSettings, arrayOfPhotoInfo )
	local ids = {}
	for _, photoInfo in ipairs( arrayOfPhotoInfo ) do
		if photoInfo.remoteId then ids[ #ids + 1 ] = photoInfo.remoteId end
	end
	if #ids == 0 then return { comments = {}, favorites = {} } end
	local ok, data = pcall( PRApi.feedback, publishSettings, ids )
	if not ok then
		LrDialogs.message( 'Could not load client notes', tostring( data ), 'warning' )
		return { comments = {}, favorites = {} }
	end
	return data
end

local function isoToTime( iso )
	if type( iso ) ~= 'string' then return nil end
	local y, mo, d, h, mi, s = iso:match( '^(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)' )
	if not y then return nil end
	return os.time { year = tonumber( y ), month = tonumber( mo ), day = tonumber( d ), hour = tonumber( h ), min = tonumber( mi ), sec = tonumber( s ) }
end

function publishServiceProvider.getCommentsFromPublishedCollection( publishSettings, arrayOfPhotoInfo, commentCallback )
	local data = loadFeedback( publishSettings, arrayOfPhotoInfo )
	for _, photoInfo in ipairs( arrayOfPhotoInfo ) do
		local list = {}
		local comments = ( data.comments and data.comments[ photoInfo.remoteId ] ) or {}
		for _, c in ipairs( comments ) do
			local who = c.author_role == 'studio' and 'You' or ( c.author_name or 'Client' )
			list[ #list + 1 ] = {
				commentId = c.id,
				commentText = ( c.resolved and '\u{2713} ' or '' ) .. ( c.body or '' ),
				dateCreated = isoToTime( c.created_at ),
				username = who,
				realname = who,
			}
		end
		commentCallback { publishedPhoto = photoInfo, comments = list }
	end
end

function publishServiceProvider.getRatingsFromPublishedCollection( publishSettings, arrayOfPhotoInfo, ratingCallback )
	local data = loadFeedback( publishSettings, arrayOfPhotoInfo )
	local favoriteSet = {}
	for _, id in ipairs( data.favorites or {} ) do favoriteSet[ id ] = true end

	local toTag = {}
	for _, photoInfo in ipairs( arrayOfPhotoInfo ) do
		local isFavorite = favoriteSet[ photoInfo.remoteId ] == true
		ratingCallback { publishedPhoto = photoInfo, rating = isFavorite and 1 or 0 }
		if isFavorite and photoInfo.photo then toTag[ #toTag + 1 ] = photoInfo.photo end
	end

	if publishSettings.tagFavorites ~= false and #toTag > 0 then
		local keywordName = publishSettings.favoriteKeyword
		if not keywordName or keywordName == '' then keywordName = 'Client Favorite' end
		local catalog = LrApplication.activeCatalog()
		pcall( function()
			catalog:withWriteAccessDo( 'Tag client favorites', function()
				local keyword = catalog:createKeyword( keywordName, {}, true, nil, true )
				if keyword then for _, photo in ipairs( toTag ) do photo:addKeyword( keyword ) end end
			end, { timeout = 15 } )
		end )
	end
end

-- ------------------------------------------------------ deletes and links

function publishServiceProvider.deletePhotosFromPublishedCollection( publishSettings, arrayOfPhotoIds, deletedCallback )
	for _, photoId in ipairs( arrayOfPhotoIds ) do
		local ok, err = pcall( PRApi.deletePhoto, publishSettings, photoId )
		if ok or tostring( err ):find( 'not found' ) then
			deletedCallback( photoId )
		else
			LrDialogs.message( 'Could not remove a photo from the gallery', tostring( err ), 'warning' )
		end
	end
end

function publishServiceProvider.deletePublishedCollection( publishSettings, info )
	-- Photos stay on the site; the gallery is hidden so the client link stops working.
	if info.remoteId then pcall( PRApi.unpublishGallery, publishSettings, info.remoteId ) end
end

function publishServiceProvider.shouldDeletePhotosFromServiceOnDeleteFromCatalog( publishSettings, nPhotos )
	return 'delete'
end

function publishServiceProvider.metadataThatTriggersRepublish( publishSettings )
	return { default = false }
end

function publishServiceProvider.goToPublishedCollection( publishSettings, info )
	if info.remoteUrl then LrHttp.openUrlInBrowser( info.remoteUrl ) end
end

function publishServiceProvider.goToPublishedPhoto( publishSettings, info )
	if info.remoteUrl then LrHttp.openUrlInBrowser( info.remoteUrl ) end
end

PRPublishSupport = publishServiceProvider

return publishServiceProvider
