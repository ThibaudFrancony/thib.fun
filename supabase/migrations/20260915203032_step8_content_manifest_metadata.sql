-- Reconcile the already-published Geography pack with the runtime manifest
-- contract. The city checksum is preserved; only the metadata required by
-- assertOptionalManifest is completed. This is additive and idempotent.
update private.content_packs
set manifest = coalesce(manifest, '{}'::jsonb) || jsonb_build_object(
  'kind', 'geography',
  'slug', 'france-metropole',
  'version', version,
  'status', 'published',
  'packId', id::text,
  'license', 'Licence Ouverte / Etalab',
  'author', 'geo.api.gouv.fr / Etalab',
  'reviewedBy', 'contrôle structurel et couverture géographique interne',
  'reviewedAt', '2026-09-14'
)
where kind = 'geography'
  and slug = 'france-metropole'
  and status = 'published'
  and version = 1
  and manifest->>'checksum' = 'fe1dd38201b06395ae254ac12b5d51422651f3adadde70b5f887efff1b246dab';
