-- tibo.fun — lecture serveur du pack TTMC sans exposition des tables privées.
create or replace function public.server_get_ttmc_content()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with pack as (
    select id, version
    from private.content_packs
    where kind = 'quiz' and slug = 'ttmc' and status = 'published'
    order by version desc
    limit 1
  ), themes as (
    select distinct on (ci.payload ->> 'themeId')
      ci.payload ->> 'themeId' as theme_id,
      ci.payload ->> 'themeLabel' as label,
      ci.payload ->> 'themeDescription' as short_description
    from private.content_items ci
    join pack on pack.id = ci.pack_id
    order by ci.payload ->> 'themeId', ci.logical_key
  )
  select jsonb_build_object(
    'packId', pack.id,
    'packVersion', pack.version,
    'themes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'themeId', theme_id,
        'label', label,
        'shortDescription', short_description
      ) order by theme_id)
      from themes
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'itemId', ci.id,
          'packId', pack.id,
          'logicalKey', ci.logical_key,
          'themeId', ci.payload ->> 'themeId',
          'themeLabel', ci.payload ->> 'themeLabel',
          'themeDescription', ci.payload ->> 'themeDescription',
          'level', (ci.payload ->> 'level')::integer,
          'prompt', ci.payload ->> 'prompt',
          'canonical', ci.payload -> 'answer' ->> 'canonical',
          'aliases', coalesce(ci.payload -> 'answer' -> 'aliases', '[]'::jsonb),
          'explanation', ci.payload ->> 'explanation'
        )) order by ci.logical_key
      )
      from private.content_items ci
      where ci.pack_id = pack.id
    ), '[]'::jsonb)
  )
  from pack;
$$;

revoke all on function public.server_get_ttmc_content() from public, anon, authenticated;
grant execute on function public.server_get_ttmc_content() to service_role;
