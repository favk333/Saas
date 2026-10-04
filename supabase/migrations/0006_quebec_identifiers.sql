-- =============================================================
-- Québec : NEQ (au lieu du SIRET) et licence RBQ
-- =============================================================

-- Un SIRET (14 chiffres) n'est pas un NEQ valide : on l'efface plutôt que de le convertir.
alter table public.profiles drop constraint profiles_siret_format;
update public.profiles set siret = null where siret !~ '^[0-9]{10}$';

-- Le privilège UPDATE de l'artisan sur cette colonne suit le renommage.
alter table public.profiles rename column siret to neq;
alter table public.profiles
  add constraint profiles_neq_format check (neq is null or neq ~ '^[0-9]{10}$');

-- Licence de la Régie du bâtiment du Québec : son numéro doit figurer
-- sur les soumissions et contrats de l'entrepreneur.
alter table public.profiles
  add column rbq_licence text check (rbq_licence is null or rbq_licence ~ '^[0-9]{10}$');

grant update (rbq_licence) on public.profiles to authenticated;
