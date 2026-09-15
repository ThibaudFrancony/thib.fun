-- Repair the local additive reconciliation with the complete 64-character
-- checksum. The previous migration remains immutable.
update private.content_packs
set manifest = manifest || jsonb_build_object(
  'checksum', '3307baba3cb7a275b38a3b43e675b17a902060866abbfe93f5b83afca791c57d'
)
where kind = 'geography'
  and slug = 'france-metropole'
  and status = 'published'
  and version = 1
  and manifest->>'checksum' = '3307baba3cb7a275b38a3b43e675b17a902060866abbfe93f5b83afca791c57';
