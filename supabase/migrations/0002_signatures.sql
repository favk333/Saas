-- =============================================================
-- Signature : preuves (signature électronique simple) + stockage
-- =============================================================

create type public.signature_channel as enum ('on_site', 'remote');

alter table public.invoices
  add column signed_via            public.signature_channel,
  add column signature_ip          text,
  add column signature_user_agent  text;

-- Bucket privé : signatures/<user_id>/<invoice_id>.png
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

-- L'artisan lit/écrit uniquement son dossier. La signature à distance
-- passe par la service role key (pas de policy publique).
create policy "own signatures read" on storage.objects
  for select to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own signatures insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own signatures update" on storage.objects
  for update to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = auth.uid()::text);
