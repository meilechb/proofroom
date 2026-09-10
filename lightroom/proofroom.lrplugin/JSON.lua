--[[----------------------------------------------------------------------------
JSON.lua — minimal JSON encoder/decoder for Lightroom's Lua 5.1 runtime.
Objects decode to tables; arrays to tables with integer keys; null to JSON.null.
------------------------------------------------------------------------------]]

local JSON = { null = setmetatable({}, { __tostring = function() return 'null' end }) }

-- ---------------------------------------------------------------- encoding

local escapes = {
	['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b', ['\f'] = '\\f',
	['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t',
}

local function encodeString( s )
	return '"' .. s:gsub( '[%c"\\]', function( c )
		return escapes[ c ] or string.format( '\\u%04x', c:byte() )
	end ) .. '"'
end

local function isArray( t )
	local n = 0
	for k in pairs( t ) do
		if type( k ) ~= 'number' then return false end
		n = n + 1
	end
	return n == #t
end

function JSON.encode( value )
	local t = type( value )
	if value == JSON.null or value == nil then
		return 'null'
	elseif t == 'boolean' then
		return value and 'true' or 'false'
	elseif t == 'number' then
		if value ~= value or value == math.huge or value == -math.huge then return 'null' end
		if math.floor( value ) == value then return string.format( '%d', value ) end
		return string.format( '%.14g', value )
	elseif t == 'string' then
		return encodeString( value )
	elseif t == 'table' then
		local parts = {}
		if isArray( value ) then
			for i = 1, #value do parts[ #parts + 1 ] = JSON.encode( value[ i ] ) end
			return '[' .. table.concat( parts, ',' ) .. ']'
		end
		for k, v in pairs( value ) do
			parts[ #parts + 1 ] = encodeString( tostring( k ) ) .. ':' .. JSON.encode( v )
		end
		return '{' .. table.concat( parts, ',' ) .. '}'
	end
	error( 'JSON.encode: unsupported type ' .. t )
end

-- ---------------------------------------------------------------- decoding

local function utf8Char( code )
	if code < 0x80 then return string.char( code ) end
	if code < 0x800 then
		return string.char( 0xC0 + math.floor( code / 0x40 ), 0x80 + code % 0x40 )
	end
	if code < 0x10000 then
		return string.char( 0xE0 + math.floor( code / 0x1000 ), 0x80 + math.floor( code / 0x40 ) % 0x40, 0x80 + code % 0x40 )
	end
	return string.char( 0xF0 + math.floor( code / 0x40000 ), 0x80 + math.floor( code / 0x1000 ) % 0x40,
		0x80 + math.floor( code / 0x40 ) % 0x40, 0x80 + code % 0x40 )
end

local unescapes = { ['"'] = '"', ['\\'] = '\\', ['/'] = '/', b = '\b', f = '\f', n = '\n', r = '\r', t = '\t' }

local decodeValue

local function skipSpace( s, i )
	return s:find( '[^ \t\r\n]', i ) or #s + 1
end

local function decodeString( s, i )
	local out, j = {}, i + 1
	while true do
		local c = s:sub( j, j )
		if c == '' then error( 'JSON.decode: unterminated string' ) end
		if c == '"' then return table.concat( out ), j + 1 end
		if c == '\\' then
			local e = s:sub( j + 1, j + 1 )
			if e == 'u' then
				local hex = s:sub( j + 2, j + 5 )
				local code = tonumber( hex, 16 )
				if not code then error( 'JSON.decode: bad unicode escape' ) end
				j = j + 6
				-- surrogate pair
				if code >= 0xD800 and code <= 0xDBFF and s:sub( j, j + 1 ) == '\\u' then
					local low = tonumber( s:sub( j + 2, j + 5 ), 16 )
					if low and low >= 0xDC00 and low <= 0xDFFF then
						code = 0x10000 + ( code - 0xD800 ) * 0x400 + ( low - 0xDC00 )
						j = j + 6
					end
				end
				out[ #out + 1 ] = utf8Char( code )
			else
				out[ #out + 1 ] = unescapes[ e ] or e
				j = j + 2
			end
		else
			out[ #out + 1 ] = c
			j = j + 1
		end
	end
end

local function decodeNumber( s, i )
	local numStr = s:match( '^-?%d+%.?%d*[eE]?[+-]?%d*', i )
	local n = tonumber( numStr )
	if not n then error( 'JSON.decode: bad number at ' .. i ) end
	return n, i + #numStr
end

local function decodeArray( s, i )
	local arr, j = {}, skipSpace( s, i + 1 )
	if s:sub( j, j ) == ']' then return arr, j + 1 end
	while true do
		local v
		v, j = decodeValue( s, j )
		arr[ #arr + 1 ] = v
		j = skipSpace( s, j )
		local c = s:sub( j, j )
		if c == ']' then return arr, j + 1 end
		if c ~= ',' then error( 'JSON.decode: expected , or ] at ' .. j ) end
		j = skipSpace( s, j + 1 )
	end
end

local function decodeObject( s, i )
	local obj, j = {}, skipSpace( s, i + 1 )
	if s:sub( j, j ) == '}' then return obj, j + 1 end
	while true do
		if s:sub( j, j ) ~= '"' then error( 'JSON.decode: expected key at ' .. j ) end
		local key
		key, j = decodeString( s, j )
		j = skipSpace( s, j )
		if s:sub( j, j ) ~= ':' then error( 'JSON.decode: expected : at ' .. j ) end
		local v
		v, j = decodeValue( s, skipSpace( s, j + 1 ) )
		obj[ key ] = v
		j = skipSpace( s, j )
		local c = s:sub( j, j )
		if c == '}' then return obj, j + 1 end
		if c ~= ',' then error( 'JSON.decode: expected , or } at ' .. j ) end
		j = skipSpace( s, j + 1 )
	end
end

decodeValue = function( s, i )
	i = skipSpace( s, i )
	local c = s:sub( i, i )
	if c == '{' then return decodeObject( s, i ) end
	if c == '[' then return decodeArray( s, i ) end
	if c == '"' then return decodeString( s, i ) end
	if c == '-' or c:match( '%d' ) then return decodeNumber( s, i ) end
	if s:sub( i, i + 3 ) == 'true' then return true, i + 4 end
	if s:sub( i, i + 4 ) == 'false' then return false, i + 5 end
	if s:sub( i, i + 3 ) == 'null' then return JSON.null, i + 4 end
	error( 'JSON.decode: unexpected character at ' .. i )
end

function JSON.decode( s )
	if type( s ) ~= 'string' then error( 'JSON.decode: expected string' ) end
	local value = decodeValue( s, 1 )
	return value
end

return JSON
