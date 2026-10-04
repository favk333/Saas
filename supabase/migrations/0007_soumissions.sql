-- =============================================================
-- Québec : « soumission » au lieu de « devis »
-- Les nouvelles soumissions sont numérotées S-AAAA-0001. Le compteur
-- continue (quote_seq) et les numéros D-… déjà attribués ne changent pas.
-- =============================================================

create or replace function public.assign_document_numbers() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  seq integer;
  yr  text := to_char(now(), 'YYYY');
begin
  if tg_op = 'INSERT' and new.quote_number is null then
    update profiles set quote_seq = quote_seq + 1 where id = new.user_id returning quote_seq into seq;
    new.quote_number := 'S-' || yr || '-' || lpad(seq::text, 4, '0');
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
