-- =============================================================
-- Profil entreprise + Stripe Connect
-- =============================================================

alter table public.profiles
  add column address                text,
  add column stripe_charges_enabled boolean not null default false,
  add constraint profiles_siret_format check (siret is null or siret ~ '^[0-9]{14}$');

create unique index profiles_stripe_account_uniq on public.profiles (stripe_account_id)
  where stripe_account_id is not null;

-- La RLS limite les lignes, pas les colonnes : sans ceci, un artisan pourrait
-- réécrire son compte Stripe, son statut de paiement ou ses compteurs de
-- numérotation (continuité légale des factures).
-- Les champs Stripe ne sont écrits que côté serveur (service role).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (company_name, phone, siret, address, default_tax_bps) on public.profiles to authenticated;
