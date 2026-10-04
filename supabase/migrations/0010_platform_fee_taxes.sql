-- =============================================================
-- TPS et TVQ sur la commission de la plateforme
-- platform_fee_cents      : commission avant taxes
-- platform_fee_tps_cents  : TPS 5 % sur la commission
-- platform_fee_tvq_cents  : TVQ 9,975 % sur la commission
-- Montant prélevé par Stripe (application_fee_amount) = la somme des trois.
-- Les liens créés avant cette migration n'ont pas de taxes (colonnes à null).
-- =============================================================

alter table public.invoices
  add column platform_fee_tps_cents integer check (platform_fee_tps_cents is null or platform_fee_tps_cents >= 0),
  add column platform_fee_tvq_cents integer check (platform_fee_tvq_cents is null or platform_fee_tvq_cents >= 0);
