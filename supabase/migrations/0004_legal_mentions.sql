-- =============================================================
-- Mentions légales des devis et factures (artisans du bâtiment)
-- =============================================================

alter table public.profiles
  add column vat_number text,   -- n° TVA intracommunautaire (vide = franchise en base)
  add column insurance  text;   -- assurance décennale : assureur, n° de contrat, zone couverte

grant update (vat_number, insurance) on public.profiles to authenticated;
