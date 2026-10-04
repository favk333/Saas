# Chantier

PWA mobile pour artisans du Québec : soumission → signature sur place → facture → paiement par SMS → relances automatiques.

Stack : Next.js (App Router) · Tailwind CSS v4 · Supabase · Stripe · Twilio.

```bash
npm install
cp .env.example .env.local   # Supabase, Twilio…
npm run dev                  # http://localhost:3000
```

Mise en production : voir **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)**.

Sans `.env.local`, l'app tourne en **mode démo** : données fictives, pas de connexion, pas d'enregistrement.

Supabase : appliquer la migration, puis dans *Authentication → URL Configuration* ajouter `<APP_URL>/auth/callback` aux Redirect URLs.

## Structure

`✓` = existe, le reste arrive aux étapes suivantes.

```
app/
  layout.tsx                     ✓ racine, viewport mobile, safe areas
  globals.css                    ✓ tokens couleurs (6 couleurs, pas de dégradé)
  manifest.ts                    ✓ manifeste PWA (icônes PNG, raccourci « Nouvelle soumission »)
  icon.svg                       ✓ favicon
  (app)/                         écrans authentifiés
    layout.tsx                   ✓ bandeau « Hors ligne »
    error.tsx                    ✓ écran de secours (réseau coupé)
    page.tsx                     ✓ Dashboard
    actions.ts                   ✓ relance SMS manuelle
    soumissions/nouveau/page.tsx     ✓ création d'une soumission
    soumissions/nouveau/actions.ts   ✓ enregistrement + envoi SMS
    soumissions/[id]/page.tsx        ✓ détail soumission / facture + lien de paiement
    soumissions/[id]/signer/page.tsx ✓ signature tactile sur place
    soumissions/[id]/pdf/route.ts    ✓ PDF soumission / facture (artisan connecté)
    soumissions/[id]/actions.ts      ✓ signer, générer / envoyer le lien
    reglages/page.tsx            ✓ profil entreprise, taxes par défaut, n° TPS / TVQ, Stripe, déconnexion
    reglages/actions.ts          ✓ enregistrer, lancer l'onboarding Stripe
  (auth)/login/page.tsx          ✓ connexion (lien magique e-mail)
  auth/callback/route.ts         ✓ retour du lien magique
  s/[token]/page.tsx             ✓ signature à distance + paiement (public)
  s/[token]/pdf/route.ts         ✓ PDF pour le client (par jeton)
  api/
    cron/relances/route.ts       ✓ relances J+3 / J+7 (Vercel Cron)
    webhooks/stripe/route.ts     ✓ paiement reçu → "paid" ; account.updated → statut Connect
    stripe/connect/route.ts      ✓ retour / relance de l'onboarding Stripe
components/
  dashboard/                     ✓ invoice-row, status-badge, remind-button
  quote/quote-form.tsx           ✓ formulaire de soumission (totaux en direct)
  quote/quote-summary.tsx        ✓ récapitulatif lignes + totaux
  invoice/invoice-actions.tsx    ✓ actions facture (lien, SMS, partage)
  signature/signature-form.tsx   ✓ pad de signature (Canvas, sans dépendance)
  settings/                      ✓ formulaire profil, section paiements
  ui/tax-regime-picker.tsx       ✓ sélecteur « TPS + TVQ » / « Sans taxes »
  service-worker.tsx             ✓ enregistrement du SW, effacement du cache
  offline-banner.tsx             ✓ bandeau hors ligne
lib/
  types.ts                       ✓ types + statut dérivé "En retard"
  format.ts                      ✓ montants en dollars canadiens (fr-CA), dates relatives
  quote.ts                       ✓ prix "1 250,50", téléphone → E.164, totaux
  data.ts                        ✓ requêtes Supabase (+ données démo)
  supabase/{config,server}.ts    ✓ client Supabase SSR
  twilio.ts                      ✓ envoi SMS (API REST)
  reminders.ts                   ✓ calendrier J+3 / J+7 + textes des SMS
  network.ts                     ✓ garde réseau des formulaires (pas d'écran perdu)
  supabase/admin.ts              ✓ client service role (pages publiques, cron)
  signature.ts                   ✓ validation PNG, stockage, passage en "signed"
  stripe.ts  payments.ts         ✓ Payment Link sur le compte Connect de l'artisan
  connect.ts                     ✓ création du compte Connect, onboarding, synchro statut
  pdf.ts                         ✓ rendu PDF (pdf-lib, Helvetica, A4, pagination)
  invoice-pdf.ts                 ✓ données vendeur + signature → réponse PDF
proxy.ts                         ✓ session Supabase + redirection /login
vercel.json                      ✓ cron quotidien 14 h UTC (10 h à Montréal l'été, 9 h l'hiver)
public/
  sw.js                          ✓ service worker (écrit à la main, sans librairie)
  offline.html                   ✓ page hors ligne autonome
  icons/                         ✓ 192, 512, maskable, apple-touch-icon
supabase/
  migrations/0001_init.sql       ✓ profiles, clients, invoices, line_items + RLS
  migrations/0002_signatures.sql ✓ bucket privé "signatures" + preuves (IP, user agent, canal)
  migrations/0003_profile_stripe.sql ✓ adresse, statut Stripe, colonnes du profil verrouillées
  migrations/0004_legal_mentions.sql ✓ assurance (et n° TVA, remplacé en 0005)
  migrations/0005_quebec_taxes.sql   ✓ CAD, TPS 5 % + TVQ 9,975 %, n° d'inscription TPS / TVQ
  migrations/0006_quebec_identifiers.sql ✓ NEQ (remplace le SIRET), licence RBQ
  migrations/0007_soumissions.sql        ✓ numérotation S-AAAA-0001 (au lieu de D-…)
```

## Base de données

- Montants en **cents** (`integer`), en **dollars canadiens** (`currency = 'cad'`).
- Taxes du Québec selon `tax_regime` : `qc` → **TPS 5 %** et **TVQ 9,975 %**, toutes deux calculées sur le sous-total (pas de taxe sur taxe) et arrondies au cent séparément ; `exempt` → petit fournisseur non inscrit, aucune taxe. `tps_cents`, `tvq_cents`, `tax_cents` et `total_cents` sont des colonnes générées ; `lib/quote.ts` reproduit le même calcul en entiers pour l'aperçu.
- `subtotal_cents` recalculé par trigger à chaque modification de ligne ; `tax_cents` et `total_cents` sont des colonnes générées.
- Une soumission et sa facture sont **la même ligne** `invoices`. À la création, la soumission reçoit son numéro (`S-AAAA-0001`). Passer `status` à `signed` attribue le numéro de facture (`F-AAAA-0001`, séquence continue par artisan), `signed_at` et l'échéance (J+7).
- Le code garde des noms anglais (`quote_number`, `createQuote`…) ; seuls les textes affichés disent « soumission ».
- « En retard » n'est pas stocké : dérivé de `due_at` côté app.
- RLS : chaque artisan ne voit que ses lignes. La page publique de signature et le cron utilisent la service role key côté serveur.

Appliquer : `supabase db push` ou coller le fichier dans le SQL Editor.

## Relances et paiements

- **Cron** `GET /api/cron/relances`, chaque jour à 14 h UTC, soit 10 h à Montréal l'été et 9 h l'hiver (`vercel.json`), protégé par `Authorization: Bearer $CRON_SECRET` (Vercel l'ajoute tout seul si la variable existe).
  - Cible : factures `signed` non payées. J+3 puis J+7 après la signature, 2 relances maximum.
  - Une relance manuelle de moins de 24 h décale la relance automatique au lendemain.
  - Chaque envoi est réservé en base avant l'appel Twilio : deux exécutions simultanées n'envoient pas de doublon. Si Twilio échoue, la réservation est annulée et l'envoi retenté au passage suivant.
  - Si la facture n'a pas encore de lien de paiement, il est créé.
- **Webhook Stripe** `POST /api/webhooks/stripe` : événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. La facture passe en `paid`, ce qui arrête les relances.
  - Dans Stripe : un endpoint « compte » (`STRIPE_WEBHOOK_SECRET`) et, avec Connect, un endpoint « comptes connectés » (`STRIPE_CONNECT_WEBHOOK_SECRET`), tous deux vers la même URL.
- **Relance manuelle** (bouton de l'accueil) : soumission envoyée → lien de signature ; facture signée → lien de paiement. Une fois par heure maximum.

Test manuel du cron :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/relances
# {"checked":4,"sent":2,"failed":[]}
```

## Stripe Connect

- Chaque artisan a son **compte Stripe standard** : il reçoit l'argent directement, gère ses virements et ses litiges dans Stripe. Les liens de paiement sont créés sur son compte (direct charges).
- **Aucun lien de paiement n'est créé tant que le compte n'est pas activé** (`stripe_charges_enabled`) : l'argent n'arrive jamais sur le compte de la plateforme.
- Parcours : Réglages → « Activer les paiements » → formulaire Stripe → retour sur `/api/stripe/connect?mode=return`, qui relit le statut. Le webhook `account.updated` le tient ensuite à jour.
- Configuration Stripe :
  1. Activer Connect sur le compte plateforme.
  2. Créer un webhook « comptes connectés » vers `/api/webhooks/stripe` avec `account.updated`, `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Son secret va dans `STRIPE_CONNECT_WEBHOOK_SECRET`.
- Les colonnes Stripe et les compteurs de numérotation du profil ne sont modifiables que côté serveur (privilèges par colonne, migration 0003).

## PDF

- `/soumissions/[id]/pdf` pour l'artisan connecté et `/s/[token]/pdf` pour le client. Les brouillons ne sont jamais exposés par le lien public.
- Le PDF est une **soumission** avant signature (validité 30 jours) et une **facture** après.
- Mentions imprimées :
  - vendeur : nom, adresse, téléphone, NEQ, licence RBQ, n° de TPS et de TVQ ;
  - numéros et dates (émission, soumission d'origine, échéance) ;
  - sous-total, TPS (5 %), TVQ (9,975 %) et total, ou « Taxes non applicables » pour un petit fournisseur non inscrit ;
  - échéance ;
  - assurance ;
  - signature du client, avec sa date et son canal (sur place ou en ligne).
- Généré à la demande, rien n'est stocké. Police Helvetica standard (jeu WinAnsi) : les caractères non couverts, comme les emoji, sont retirés.

## PWA et réseau faible

- **Service worker** (`public/sw.js`, actif uniquement en production) :
  - fichiers versionnés de Next (`/_next/static`) : servis depuis le cache ;
  - pages : réseau d'abord avec un délai de **3 s**, puis la dernière version vue, puis `offline.html` ;
  - jamais en cache : `/api`, `/auth`, `/login`, `/s/…`, les PDF, les envois de formulaires.
- **Déconnexion** : les pages en cache, qui contiennent les données de l'artisan, sont effacées.
- **Formulaires** : hors ligne ou coupure en cours d'envoi, un message s'affiche et la saisie reste à l'écran (`lib/network.ts`).
- **Brouillon de soumission** : enregistré sur le téléphone à chaque frappe, restauré à la réouverture, effacé après un envoi réussi.
- **Nouvelle version** : changer `VERSION` dans `sw.js` vide l'ancien cache des fichiers statiques.
- Pas de file d'attente hors ligne : créer, signer ou relancer demande du réseau.
