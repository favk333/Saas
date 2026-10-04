-- =============================================================
-- Commission de la plateforme sur les paiements en ligne
-- Montant demandé à Stripe (application fee) à la création du lien de paiement.
-- Informatif : c'est Stripe qui prélève réellement la commission.
-- =============================================================

alter table public.invoices
  add column platform_fee_cents integer check (platform_fee_cents is null or platform_fee_cents >= 0);
