# Chantier

PWA mobile pour artisans : devis → signature sur place → facture → paiement par SMS → relances automatiques.

Stack : Next.js (App Router) · Tailwind CSS v4 · Supabase · Stripe · Twilio.

```bash
npm install
cp .env.example .env.local   # Supabase, Twilio…
npm run dev                  # http://localhost:3000
```

Sans `.env.local`, l'app tourne en **mode démo** : données fictives, pas de connexion, pas d'enregistrement.

Supabase : appliquer la migration, puis dans *Authentication → URL Configuration* ajouter `<APP_URL>/auth/callback` aux Redirect URLs.

## Structure

`✓` = existe, le reste arrive aux étapes suivantes.

```
app/
  layout.tsx                     ✓ racine, viewport mobile, safe areas
  globals.css                    ✓ tokens couleurs (6 couleurs, pas de dégradé)
  manifest.ts                    ✓ manifeste PWA
  icon.svg                       ✓
  (app)/                         écrans authentifiés
    page.tsx                     ✓ Dashboard
    actions.ts                   ✓ relance SMS manuelle
    devis/nouveau/page.tsx       ✓ création devis
    devis/nouveau/actions.ts     ✓ enregistrement + envoi SMS
    devis/[id]/page.tsx          ✓ détail devis / facture + lien de paiement
    devis/[id]/signer/page.tsx   ✓ signature tactile sur place
    devis/[id]/actions.ts        ✓ signer, générer / envoyer le lien
  (auth)/login/page.tsx          ✓ connexion (lien magique e-mail)
  auth/callback/route.ts         ✓ retour du lien magique
  s/[token]/page.tsx             ✓ signature à distance + paiement (public)
  api/
    cron/relances/route.ts       ✓ relances J+3 / J+7 (Vercel Cron)
    webhooks/stripe/route.ts     ✓ paiement reçu → statut "paid"
components/
  dashboard/                     ✓ invoice-row, status-badge, remind-button
  quote/quote-form.tsx           ✓ formulaire devis (totaux en direct)
  quote/quote-summary.tsx        ✓ récapitulatif lignes + totaux
  invoice/invoice-actions.tsx    ✓ actions facture (lien, SMS, partage)
  signature/signature-form.tsx   ✓ pad de signature (Canvas, sans dépendance)
lib/
  types.ts                       ✓ types + statut dérivé "En retard"
  format.ts                      ✓ montants €, dates relatives
  quote.ts                       ✓ prix "1 250,50", téléphone → E.164, totaux
  data.ts                        ✓ requêtes Supabase (+ données démo)
  supabase/{config,server}.ts    ✓ client Supabase SSR
  twilio.ts                      ✓ envoi SMS (API REST)
  reminders.ts                   ✓ calendrier J+3 / J+7 + textes des SMS
  supabase/admin.ts              ✓ client service role (pages publiques, cron)
  signature.ts                   ✓ validation PNG, stockage, passage en "signed"
  stripe.ts  payments.ts         ✓ Payment Link (Stripe Connect si configuré)
proxy.ts                         ✓ session Supabase + redirection /login
vercel.json                      ✓ cron quotidien 8 h UTC
supabase/
  migrations/0001_init.sql       ✓ profiles, clients, invoices, line_items + RLS
  migrations/0002_signatures.sql ✓ bucket privé "signatures" + preuves (IP, user agent, canal)
```

## Base de données

- Montants en **centimes** (`integer`), TVA en **points de base** (`2000` = 20 %).
- `subtotal_cents` recalculé par trigger à chaque modification de ligne ; `tax_cents` et `total_cents` sont des colonnes générées.
- Un devis et sa facture sont **la même ligne** `invoices` : passer `status` à `signed` attribue le numéro de facture (`F-AAAA-0001`, séquence continue par artisan), `signed_at` et l'échéance (J+7).
- « En retard » n'est pas stocké : dérivé de `due_at` côté app.
- RLS : chaque artisan ne voit que ses lignes. La page publique de signature et le cron utilisent la service role key côté serveur.

Appliquer : `supabase db push` ou coller le fichier dans le SQL Editor.

## Relances et paiements

- **Cron** `GET /api/cron/relances`, chaque jour à 8 h UTC (`vercel.json`), protégé par `Authorization: Bearer $CRON_SECRET` (Vercel l'ajoute tout seul si la variable existe).
  - Cible : factures `signed` non payées. J+3 puis J+7 après la signature, 2 relances maximum.
  - Une relance manuelle de moins de 24 h décale la relance automatique au lendemain.
  - Chaque envoi est réservé en base avant l'appel Twilio : deux exécutions simultanées n'envoient pas de doublon. Si Twilio échoue, la réservation est annulée et l'envoi retenté au passage suivant.
  - Si la facture n'a pas encore de lien de paiement, il est créé.
- **Webhook Stripe** `POST /api/webhooks/stripe` : événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. La facture passe en `paid`, ce qui arrête les relances.
  - Dans Stripe : un endpoint « compte » (`STRIPE_WEBHOOK_SECRET`) et, avec Connect, un endpoint « comptes connectés » (`STRIPE_CONNECT_WEBHOOK_SECRET`), tous deux vers la même URL.
- **Relance manuelle** (bouton de l'accueil) : devis envoyé → lien de signature ; facture signée → lien de paiement. Une fois par heure maximum.

Test manuel du cron :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/relances
# {"checked":4,"sent":2,"failed":[]}
```
