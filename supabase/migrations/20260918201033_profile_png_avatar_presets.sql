-- tibo.fun — avatars PNG : 10 presets avatar-1..avatar-10
--
-- Les 10 PNG transparents vivent dans public/avatars/avatar-N.png
-- (ordre de la grille : étoile verte, cœur rose, soleil, lune, nuage,
-- chat, robot, lapin, panda, fusée). Les anciens presets orbit-1..orbit-8
-- (sans images, couleurs seules) sont repris positionnellement vers
-- avatar-1..avatar-8 ; aucun compte n'est supprimé.

alter table public.profiles drop constraint if exists profiles_avatar_preset;

update public.profiles
set avatar_preset = 'avatar-' || substr(avatar_preset, 7)
where avatar_preset like 'orbit-%';

alter table public.profiles alter column avatar_preset set default 'avatar-1';

alter table public.profiles
  add constraint profiles_avatar_preset check (
    avatar_preset in (
      'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5',
      'avatar-6', 'avatar-7', 'avatar-8', 'avatar-9', 'avatar-10'
    )
  );
