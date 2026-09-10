--[[----------------------------------------------------------------------------
PRApi.lua
HTTP client for the Proofroom Lightroom API (/api/lr/*). Every call raises a Lua
error with a readable message on failure (plan 18.19). Uploads are server-side:
begin returns an uploadUrl, and the bytes are PUT there.
------------------------------------------------------------------------------]]

local LrFileUtils = import 'LrFileUtils'
local LrHttp = import 'LrHttp'

local JSON = require 'JSON'

PRApi = {}

local function trim( s )
	return ( tostring( s or '' ):gsub( '^%s+', '' ):gsub( '%s+$', '' ) )
end

local function baseUrl( settings )
	local url = trim( settings.siteUrl ):gsub( '/+$', '' )
	if url == '' then error( 'Enter your site URL in the publish service settings.' ) end
	if not url:match( '^https?://' ) then url = 'https://' .. url end
	return url
end

local function authHeaders( settings, contentType )
	local token = trim( settings.apiToken )
	if token == '' then error( 'Enter your API token (Studio → Settings → Lightroom) in the publish service settings.' ) end
	local h = {
		{ field = 'Authorization', value = 'Bearer ' .. token },
		{ field = 'Accept', value = 'application/json' },
		{ field = 'User-Agent', value = 'Proofroom-Lightroom/1.0' },
	}
	if contentType then h[ #h + 1 ] = { field = 'Content-Type', value = contentType } end
	return h
end

local function parse( result, hdrs, what )
	local status = hdrs and hdrs.status
	if not status then
		local detail = hdrs and hdrs.error and hdrs.error.name or 'no response'
		error( string.format( 'Could not reach your site while %s (%s). Check the site URL and your connection.', what, tostring( detail ) ) )
	end
	local data
	if result and result ~= '' then
		local ok, decoded = pcall( JSON.decode, result )
		if ok then data = decoded end
	end
	if status >= 400 then
		local message = ( type( data ) == 'table' and data.error ) or ( 'HTTP ' .. tostring( status ) )
		if status == 401 then message = 'Your API token was rejected. Create a new one in Studio → Settings → Lightroom.' end
		if status == 402 then message = 'Your account is read-only. Update billing to publish again.' end
		if status == 429 then message = 'Too many requests. Wait a moment and try again.' end
		error( string.format( '%s failed: %s', what, message ) )
	end
	return data or {}
end

function PRApi.request( settings, method, path, body, what )
	local url = baseUrl( settings ) .. '/api/lr' .. path
	local result, hdrs
	if method == 'GET' then
		result, hdrs = LrHttp.get( url, authHeaders( settings ), 30 )
	else
		local payload = body and JSON.encode( body ) or ''
		result, hdrs = LrHttp.post( url, payload, authHeaders( settings, 'application/json' ), method, 60 )
	end
	return parse( result, hdrs, what or ( method .. ' ' .. path ) )
end

-- ---------------------------------------------------------------- endpoints

function PRApi.ping( settings )
	return PRApi.request( settings, 'GET', '/ping', nil, 'testing the connection' )
end

function PRApi.listClients( settings )
	return PRApi.request( settings, 'GET', '/clients', nil, 'loading clients' ).clients or {}
end

function PRApi.createClient( settings, name, email )
	return PRApi.request( settings, 'POST', '/clients', { name = name, email = email }, 'creating the client' ).client
end

function PRApi.createGallery( settings, clientId, title, kind )
	return PRApi.request( settings, 'POST', '/galleries',
		{ client_id = clientId, title = title, kind = kind }, 'creating the gallery' ).gallery
end

function PRApi.getGallery( settings, galleryId )
	return PRApi.request( settings, 'GET', '/galleries/' .. galleryId, nil, 'loading the gallery' )
end

function PRApi.publishGallery( settings, galleryId )
	return PRApi.request( settings, 'POST', '/galleries/' .. galleryId .. '/publish', nil, 'publishing the gallery' )
end

function PRApi.unpublishGallery( settings, galleryId )
	return PRApi.request( settings, 'POST', '/galleries/' .. galleryId .. '/unpublish', nil, 'hiding the gallery' )
end

function PRApi.beginUpload( settings, galleryId, lrPhotoId, fileName, size )
	return PRApi.request( settings, 'POST', '/photos/begin',
		{ gallery_id = galleryId, lr_photo_id = lrPhotoId, filename = fileName, content_type = 'image/jpeg', size = size },
		'preparing the upload' )
end

--- PUTs the rendered JPEG bytes to the uploadUrl returned by begin.
function PRApi.uploadFile( uploadUrl, token, filePath )
	local data = LrFileUtils.readFile( filePath )
	if not data then error( 'Could not read the exported file ' .. tostring( filePath ) ) end
	local headers = {
		{ field = 'Authorization', value = 'Bearer ' .. trim( token ) },
		{ field = 'Content-Type', value = 'image/jpeg' },
	}
	local result, hdrs = LrHttp.post( uploadUrl, data, headers, 'PUT', 600 )
	local status = hdrs and hdrs.status
	if not status then error( 'The upload did not reach your site.' ) end
	if status >= 400 then
		error( string.format( 'The upload was rejected (HTTP %d): %s', status, tostring( result ):sub( 1, 200 ) ) )
	end
	local ok, data2 = pcall( JSON.decode, result )
	return ok and data2 or {}
end

function PRApi.replacePhoto( settings, photoId, fileName )
	return PRApi.request( settings, 'PATCH', '/photos/' .. photoId, { filename = fileName }, 'replacing the photo' )
end

function PRApi.deletePhoto( settings, photoId )
	return PRApi.request( settings, 'DELETE', '/photos/' .. photoId, nil, 'removing the photo' )
end

--- Favorites and comments for a batch of published photos, keyed by photo id.
function PRApi.feedback( settings, photoIds )
	return PRApi.request( settings, 'POST', '/feedback', { photo_ids = photoIds }, 'loading client notes' )
end

return PRApi
