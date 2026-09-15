-- PostgreSQL jsonb canonicalises object-key order before the geography RPC
-- returns its rows. Keep the file-pack checksum in content/geography and
-- record the checksum of the published database representation separately in
-- this database manifest so the loader validates the bytes it actually reads.
update private.content_packs
set manifest = manifest || jsonb_build_object(
  'checksum', '9d5413151f3261fedf0b47e2322d5732a9d3097f8e56f93dc9ad2b51c901c2a5',
  'checksumEncoding', 'postgres-jsonb'
)
where kind = 'geography'
  and slug = 'france-metropole'
  and status = 'published'
  and version = 1
  and manifest->>'checksum' = 'fe1dd38201b06395ae254ac12b5d51422651f3adadde70b5f887efff1b246dab';
