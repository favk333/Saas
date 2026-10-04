-- =============================================================
-- Signature hors ligne avec envoi différé
-- La soumission est signée sur le téléphone sans réseau, puis envoyée
-- au serveur plus tard. signed_at garde l'heure réelle de la signature
-- (heure du téléphone, bornée côté serveur) ; signature_ip et
-- signature_user_agent sont ceux de l'envoi.
-- =============================================================

alter table public.invoices
  add column signed_offline boolean not null default false;
