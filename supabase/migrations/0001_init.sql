-- =============================================================
-- Schéma initial : profils, clients, devis/factures, lignes
-- Montants en centimes (integer) : pas d'erreur d'arrondi float.
-- Taux de TVA en points de base : 2000 = 20 %, 1000 = 10 %, 550 = 5,5 %.
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- Profil entreprise (1 ligne par utilisateur auth)
-- Porte le nom affiché dans l'en-tête et les compteurs de numérotation.
-- -------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  company_name      text not null default '',
  phone             text,
  siret             text,
  default_tax_bps   integer not null default 2000 check (default_tax_bps between 0 and 10000),
  stripe_account_id text,               -- compte Stripe Connect de l'artisan
  quote_seq         integer not null default 0,
  invoice_seq       integer not null default 0,
  created_at        timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Clients
-- -------------------------------------------------------------
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  phone        text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'), -- format E.164 (Twilio)
  email        text,
  address      text,
  created_at   timestamptz not null default now()
);

create index clients_user_id_idx on public.clients (user_id);
create unique index clients_user_phone_uniq on public.clients (user_id, phone);

-- -------------------------------------------------------------
-- Devis / Factures (même table : un devis signé devient une facture)
-- -------------------------------------------------------------
create type public.document_status as enum (
  'draft',     -- brouillon
  'sent',      -- devis envoyé, en attente de signature
  'signed',    -- signé => facture émise, en attente de paiement
  'paid',      -- payé
  'canceled'
);

create table public.invoices (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  client_id             uuid not null references public.clients (id) on delete restrict,
  status                public.document_status not null default 'draft',

  quote_number          text,          -- D-2026-0001 (attribué à la création)
  invoice_number        text,          -- F-2026-0001 (attribué à la signature)
  site_address          text,          -- adresse du chantier

  tax_bps               integer not null default 2000 check (tax_bps between 0 and 10000),
  subtotal_cents        integer not null default 0 check (subtotal_cents >= 0),  -- maintenu par trigger
  tax_cents             integer generated always as (round(subtotal_cents * tax_bps / 10000.0)::integer) stored,
  total_cents           integer generated always as (subtotal_cents + round(subtotal_cents * tax_bps / 10000.0)::integer) stored,
  currency              text not null default 'eur',

  -- Signature
  sign_token            text not null unique default encode(gen_random_bytes(16), 'hex'), -- lien public /s/[token]
  signature_path        text,          -- chemin dans Supabase Storage
  signed_at             timestamptz,

  -- Paiement
  stripe_payment_link_id  text,
  stripe_payment_link_url text,
  paid_at               timestamptz,
  due_at                timestamptz,   -- échéance (par défaut signed_at + 7 j)

  -- Relances SMS (J+3, J+7)
  reminders_sent        smallint not null default 0,
  last_reminder_at      timestamptz,

  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint invoice_number_when_signed
    check (status not in ('signed', 'paid') or invoice_number is not null)
);

create index invoices_user_status_idx on public.invoices (user_id, status, created_at desc);
create index invoices_client_idx on public.invoices (client_id);
-- Index partiel pour le cron de relance : factures signées non payées.
create index invoices_unpaid_idx on public.invoices (signed_at) where status = 'signed';

-- -------------------------------------------------------------
-- Lignes d'articles
-- -------------------------------------------------------------
create table public.line_items (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.invoices (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade, -- dénormalisé pour RLS simple
  position          smallint not null default 0,
  description       text not null check (length(trim(description)) > 0),
  quantity          numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  total_cents       integer generated always as (round(quantity * unit_price_cents)::integer) stored,
  created_at        timestamptz not null default now()
);

create index line_items_invoice_idx on public.line_items (invoice_id, position);

-- =============================================================
-- Triggers
-- =============================================================

-- updated_at automatique
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger invoices_touch before update on public.invoices
for each row execute function public.touch_updated_at();

-- Recalcul du sous-total quand les lignes changent
create function public.recompute_invoice_subtotal() returns trigger
language plpgsql as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices
     set subtotal_cents = coalesce((select sum(total_cents) from public.line_items where invoice_id = target), 0)
   where id = target;
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    update public.invoices
       set subtotal_cents = coalesce((select sum(total_cents) from public.line_items where invoice_id = old.invoice_id), 0)
     where id = old.invoice_id;
  end if;
  return null;
end $$;

create trigger line_items_recompute
after insert or update or delete on public.line_items
for each row execute function public.recompute_invoice_subtotal();

-- Numérotation continue par artisan (obligation légale pour les factures).
-- L'UPDATE ... RETURNING verrouille la ligne profil => pas de doublon en concurrence.
create function public.assign_document_numbers() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  seq integer;
  yr  text := to_char(now(), 'YYYY');
begin
  if tg_op = 'INSERT' and new.quote_number is null then
    update profiles set quote_seq = quote_seq + 1 where id = new.user_id returning quote_seq into seq;
    new.quote_number := 'D-' || yr || '-' || lpad(seq::text, 4, '0');
  end if;

  if new.status = 'signed' and new.invoice_number is null then
    update profiles set invoice_seq = invoice_seq + 1 where id = new.user_id returning invoice_seq into seq;
    new.invoice_number := 'F-' || yr || '-' || lpad(seq::text, 4, '0');
    new.signed_at := coalesce(new.signed_at, now());
    new.due_at    := coalesce(new.due_at, new.signed_at + interval '7 days');
  end if;

  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end $$;

create trigger invoices_numbers
before insert or update of status on public.invoices
for each row execute function public.assign_document_numbers();

-- Création automatique du profil à l'inscription
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, company_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'company_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =============================================================
-- Row Level Security : chaque artisan ne voit que ses données.
-- La signature à distance (/s/[token]) et le cron passent par la
-- service role key côté serveur, jamais par une policy publique.
-- =============================================================

alter table public.profiles   enable row level security;
alter table public.clients    enable row level security;
alter table public.invoices   enable row level security;
alter table public.line_items enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own clients" on public.clients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own invoices" on public.invoices
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  );

create policy "own line items" on public.line_items
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
