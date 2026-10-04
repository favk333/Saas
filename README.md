# Chantier

PWA mobile pour artisans : devis → signature sur place → facture → paiement par SMS → relances automatiques.

Stack : Next.js (App Router) · Tailwind CSS v4 · Supabase · Stripe · Twilio.

```bash
npm install
npm run dev          # http://localhost:3000
```

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
    devis/nouveau/page.tsx         création devis
    devis/[id]/page.tsx            détail devis / facture
    devis/[id]/signer/page.tsx     signature tactile sur place
  (auth)/login/page.tsx            connexion (magic link Supabase)
  s/[token]/page.tsx               signature à distance (lien SMS, public)
  api/
    cron/relances/route.ts         relances J+3 / J+7 (Vercel Cron)
    webhooks/stripe/route.ts       paiement reçu → statut "paid"
components/
  dashboard/                     ✓ invoice-row, status-badge
  invoice/                         formulaire, lignes d'articles
  signature/                       pad de signature (canvas)
lib/
  types.ts                       ✓ types + statut dérivé "En retard"
  format.ts                      ✓ montants €, dates relatives
  data.ts                        ✓ données démo (→ Supabase)
  supabase/{server,client}.ts      clients Supabase (SSR)
  stripe.ts  twilio.ts             intégrations
supabase/
  migrations/0001_init.sql       ✓ profiles, clients, invoices, line_items + RLS
```

## Base de données

- Montants en **centimes** (`integer`), TVA en **points de base** (`2000` = 20 %).
- `subtotal_cents` recalculé par trigger à chaque modification de ligne ; `tax_cents` et `total_cents` sont des colonnes générées.
- Un devis et sa facture sont **la même ligne** `invoices` : passer `status` à `signed` attribue le numéro de facture (`F-AAAA-0001`, séquence continue par artisan), `signed_at` et l'échéance (J+7).
- « En retard » n'est pas stocké : dérivé de `due_at` côté app.
- RLS : chaque artisan ne voit que ses lignes. La page publique de signature et le cron utilisent la service role key côté serveur.

Appliquer : `supabase db push` ou coller le fichier dans le SQL Editor.
