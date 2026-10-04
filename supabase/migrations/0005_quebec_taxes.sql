-- =============================================================
-- Québec : dollars canadiens, TPS 5 % + TVQ 9,975 %
-- Les deux taxes sont calculées sur le sous-total (la TVQ ne s'applique
-- pas sur la TPS depuis 2013) et arrondies au cent séparément.
-- =============================================================

create type public.tax_regime as enum (
  'qc',      -- TPS + TVQ
  'exempt'   -- petit fournisseur non inscrit : aucune taxe
);

-- ---- Devis / factures ----
alter table public.invoices
  drop column total_cents,
  drop column tax_cents,
  drop column tax_bps;

alter table public.invoices
  add column tax_regime  public.tax_regime not null default 'qc',
  add column tps_cents   integer generated always as
    (case when tax_regime = 'qc' then round(subtotal_cents * 0.05)::integer else 0 end) stored,
  add column tvq_cents   integer generated always as
    (case when tax_regime = 'qc' then round(subtotal_cents * 0.09975)::integer else 0 end) stored,
  add column tax_cents   integer generated always as
    (case when tax_regime = 'qc'
      then round(subtotal_cents * 0.05)::integer + round(subtotal_cents * 0.09975)::integer
      else 0 end) stored,
  add column total_cents integer generated always as
    (subtotal_cents + case when tax_regime = 'qc'
      then round(subtotal_cents * 0.05)::integer + round(subtotal_cents * 0.09975)::integer
      else 0 end) stored;

alter table public.invoices alter column currency set default 'cad';
-- Documents pas encore facturés via Stripe : on les bascule en CAD.
update public.invoices set currency = 'cad' where stripe_payment_link_id is null;

-- ---- Profil : régime par défaut et numéros d'inscription (obligatoires sur les factures) ----
alter table public.profiles
  drop column default_tax_bps,
  drop column vat_number,
  add column default_tax_regime public.tax_regime not null default 'qc',
  add column tps_number text check (tps_number is null or tps_number ~ '^[0-9]{9}RT[0-9]{4}$'),  -- 123456789 RT0001
  add column tvq_number text check (tvq_number is null or tvq_number ~ '^[0-9]{10}TQ[0-9]{4}$'); -- 1234567890 TQ0001

grant update (default_tax_regime, tps_number, tvq_number) on public.profiles to authenticated;
