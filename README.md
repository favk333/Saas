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
    actions.ts                   ✓ server actions (relance SMS : stub)
    devis/nouveau/page.tsx       ✓ création devis
    devis/nouveau/actions.ts     ✓ enregistrement + envoi SMS
    devis/[id]/page.tsx          ✓ détail devis / facture + lien de paiement
    devis/[id]/signer/page.tsx   ✓ signature tactile sur place
    devis/[id]/actions.ts        ✓ signer, générer / envoyer le lien
  (auth)/login/page.tsx          ✓ connexion (lien magique e-mail)
  auth/callback/route.ts         ✓ retour du lien magique
  s/[token]/page.tsx             ✓ signature à distance + paiement (public)
  api/
    cron/relances/route.ts         relances J+3 / J+7 (Vercel Cron)
    webhooks/stripe/route.ts       paiement reçu → statut "paid"
components/
  dashboard/                     ✓ invoice-row, status-badge
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
  supabase/admin.ts              ✓ client service role (pages publiques, cron)
  signature.ts                   ✓ validation PNG, stockage, passage en "signed"
  stripe.ts  payments.ts         ✓ Payment Link (Stripe Connect si configuré)
proxy.ts                         ✓ session Supabase + redirection /login
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
