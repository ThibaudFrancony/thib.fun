-- The database RPC orders cities by INSEE code while the historical file pack
-- grouped them by difficulty. Checksum the same ordered logical content on
-- both paths; the values remain identical and only serialization order changes.
update private.content_packs
set manifest = manifest || jsonb_build_object(
  'checksum', '3307baba3cb7a275b38a3b43e675b17a902060866abbfe93f5b83afca791c57',
  'checksumEncoding', 'stable-insee-code-order'
)
where kind = 'geography'
  and slug = 'france-metropole'
  and status = 'published'
  and version = 1
  and manifest->>'checksum' = '9d5413151f3261fedf0b47e2322d5732a9d3097f8e56f93dc9ad2b51c901c2a5';
