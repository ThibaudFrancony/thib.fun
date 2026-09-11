-- tibo.fun — RPC serveur de lecture du pack quiz Trou Noir (réponse plate runtime).
-- Retourne exactement les champs de quizQuestionSchema : aucune table privée
-- n'est interrogée directement via PostgREST côté applicatif.

create or replace function public.server_get_quiz_content()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with pack as (
    select id, version
    from private.content_packs
    where kind = 'quiz' and slug = 'trou-noir' and status = 'published'
    order by version desc
    limit 1
  )
  select jsonb_build_object(
    'packId', pack.id,
    'packVersion', pack.version,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'itemId', ci.id,
          'packId', pack.id,
          'logicalKey', ci.logical_key,
          'category', ci.payload ->> 'category',
          'themeLabel', ci.payload ->> 'themeLabel',
          'difficulty', (ci.payload ->> 'difficulty')::integer,
          'prompt', ci.payload ->> 'prompt',
          'canonical', ci.payload -> 'answer' ->> 'canonical',
          'aliases', coalesce(ci.payload -> 'answer' -> 'aliases', '[]'::jsonb),
          'answerType', ci.payload -> 'answer' ->> 'type',
          'requiredPrecision', ci.payload -> 'answer' ->> 'requiredPrecision',
          'allowSurnameOnly', coalesce((ci.payload -> 'answer' ->> 'allowSurnameOnly')::boolean, false),
          'allowDescription', coalesce((ci.payload -> 'answer' ->> 'allowDescription')::boolean, false),
          'numericValue', case
            when ci.payload -> 'answer' ->> 'numericValue' is null then null
            else (ci.payload -> 'answer' ->> 'numericValue')::float
          end,
          'numericTolerance', coalesce((ci.payload -> 'answer' ->> 'numericTolerance')::float, 0),
          'explanation', ci.payload ->> 'explanation'
        )) order by ci.logical_key
      )
      from private.content_items ci
      where ci.pack_id = pack.id
    ), '[]'::jsonb)
  )
  from pack;
$$;

revoke all on function public.server_get_quiz_content() from public, anon, authenticated;
grant execute on function public.server_get_quiz_content() to service_role;
