# Checklist de déploiement

Ordre conseillé : **tout en mode test** (Stripe test, Twilio vers ton propre numéro), recette complète, puis bascule en production (section 8).

Durée estimée : 2 à 3 h la première fois, hors délais de validation Stripe et Twilio.

---

## 0. Prérequis

- [ ] Comptes : Supabase, Vercel, Stripe, Twilio, et un fournisseur d'e-mail (Resend, Brevo, Postmark… voir section 2, SMTP).
- [ ] Un nom de domaine. Optionnel au début : l'URL `*.vercel.app` suffit pour la recette.
- [ ] Générer le secret du cron et le garder de côté :
  ```bash
  openssl rand -hex 32   # → CRON_SECRET
  ```

---

## 1. Supabase : base de données

- [ ] Créer le projet dans la région **Europe (Paris, `eu-west-3`)**. Les données des clients (téléphones, signatures, IP) restent ainsi dans l'UE.
- [ ] Appliquer les 4 migrations **dans l'ordre**, avec l'une des deux méthodes :
  - CLI :
    ```bash
    supabase link --project-ref <ref>
    supabase db push
    ```
  - SQL Editor : coller et exécuter `0001_init.sql`, `0002_signatures.sql`, `0003_profile_stripe.sql`, puis `0004_legal_mentions.sql`.
- [ ] Vérifier :
  - **Table Editor** : les tables `profiles`, `clients`, `invoices` et `line_items` existent, chacune avec l'icône RLS activée.
  - **Storage** : le bucket `signatures` existe et est **privé**.
  - **Database → Triggers** : `invoices_numbers`, `line_items_recompute` et `on_auth_user_created` sont présents.
- [ ] Récupérer dans **Settings → API Keys** :

  | Valeur Supabase | Variable |
  |---|---|
  | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
  | Clé **publishable** (ou `anon` legacy) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
  | Clé **secret** (ou `service_role` legacy) | `SUPABASE_SERVICE_ROLE_KEY` |

  ⚠️ La clé secret contourne la RLS. Elle ne doit jamais avoir le préfixe `NEXT_PUBLIC_`.

---

## 2. Supabase : authentification

- [ ] **Authentication → Sign In / Providers → Email** : activé. Le lien magique est envoyé par e-mail, aucun mot de passe n'est utilisé.
- [ ] **Authentication → URL Configuration** :
  - Site URL : `https://<domaine>`
  - Redirect URLs : `https://<domaine>/auth/callback`. Ajouter aussi `http://localhost:3000/auth/callback` pour le développement.
- [ ] **Templates d'e-mail** (optionnel mais conseillé) : traduire « Magic Link » en français. Garder `{{ .ConfirmationURL }}` comme lien.
- [ ] **SMTP personnalisé (indispensable avant de vrais utilisateurs).** L'envoi d'e-mails intégré à Supabase est limité à quelques messages par heure et réservé aux tests. Configurer un fournisseur dans **Authentication → Emails → SMTP Settings**, avec un expéditeur sur ton domaine (SPF/DKIM configurés).

---

## 3. Vercel : application

- [ ] Importer le dépôt GitHub. Framework : Next.js, détecté automatiquement.
- [ ] **Settings → Functions → Region** : `cdg1` (Paris), près de la base Supabase.
- [ ] **Settings → Environment Variables** (Production + Preview) :

  | Variable | Valeur |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | section 1 |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | section 1 |
  | `SUPABASE_SERVICE_ROLE_KEY` | section 1 |
  | `NEXT_PUBLIC_APP_URL` | `https://<domaine>`, sans `/` final |
  | `CRON_SECRET` | section 0 |
  | `STRIPE_SECRET_KEY` | section 4 (`sk_test_…` d'abord) |
  | `STRIPE_WEBHOOK_SECRET` | section 4 |
  | `STRIPE_CONNECT_WEBHOOK_SECRET` | section 4 |
  | `TWILIO_ACCOUNT_SID` | section 5 |
  | `TWILIO_AUTH_TOKEN` | section 5 |
  | `TWILIO_FROM_NUMBER` | section 5 |

  ⚠️ **`NEXT_PUBLIC_APP_URL` est critique.** Il sert à construire les liens envoyés par SMS. S'il est absent, les clients reçoivent un lien cassé (`undefined/s/…`).

  ⚠️ **Les variables `NEXT_PUBLIC_*` sont figées au moment du build.** Après toute modification, il faut **redéployer**.
- [ ] Déployer, puis vérifier que l'URL ouvre bien `/login`.
- [ ] Domaine personnalisé (**Settings → Domains**), si tu en as un. Ensuite :
  - mettre à jour `NEXT_PUBLIC_APP_URL` et redéployer ;
  - mettre à jour les URLs Supabase (section 2) ;
  - mettre à jour l'URL des webhooks Stripe (section 4).
- [ ] **Cron** : **Settings → Cron Jobs** doit afficher `/api/cron/relances`, chaque jour à 8 h UTC (10 h à Paris l'été, 9 h l'hiver). Vercel ajoute tout seul l'en-tête `Authorization: Bearer $CRON_SECRET`.

---

## 4. Stripe : paiements et Connect

Commencer en **mode test** : le sélecteur est en haut à droite du dashboard Stripe.

- [ ] **Activer Connect** (**Connect → Get started**) et choisir le modèle « plateforme ». Les artisans auront des comptes **Standard** : ils reçoivent l'argent directement sur leur compte.
- [ ] **Connect → Settings → Branding** : nom (« Chantier »), icône et couleur `#111827`. C'est ce que l'artisan voit pendant l'activation de son compte.
- [ ] **Clé API** : **Developers → API keys**, copier la clé secrète dans `STRIPE_SECRET_KEY`.
- [ ] **Webhook 1, compte de la plateforme** (**Developers → Webhooks → Add endpoint**) :
  - URL : `https://<domaine>/api/webhooks/stripe`
  - Écoute : **Your account**
  - Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`
  - Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
- [ ] **Webhook 2, comptes connectés** (c'est le plus important, car les paiements ont lieu sur les comptes des artisans) :
  - Même URL que le webhook 1.
  - Écoute : **Connected accounts**
  - Événements : `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`
  - Copier le secret de signature dans `STRIPE_CONNECT_WEBHOOK_SECRET`.
- [ ] Redéployer sur Vercel après avoir ajouté les secrets.
- [ ] Commission de la plateforme : aucune pour l'instant. Les liens de paiement n'ont pas de `application_fee_amount`. C'est à décider avant la production si le modèle économique en prévoit une.

---

## 5. Twilio : SMS

- [ ] **Messaging → Settings → Geo permissions** : autoriser **France**, plus les autres pays de tes clients.
- [ ] **Expéditeur des SMS.** Les règles françaises évoluent régulièrement, donc les vérifier dans la console Twilio au moment de l'inscription. Deux options :
  - **Sender ID alphanumérique** (ex. `Chantier`, 11 caractères max) : simple et lisible, mais le client ne peut pas répondre. Une procédure d'enregistrement peut être demandée.
  - **Numéro français** acheté chez Twilio : le client peut répondre, mais des documents réglementaires sont exigés.
- [ ] Remplir `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, et `TWILIO_FROM_NUMBER` (au format `+33…`, ou le Sender ID alphanumérique).
- [ ] Compte d'essai : il n'envoie qu'aux numéros vérifiés. Ajouter ton portable dans **Verified Caller IDs** pour la recette.
- [ ] Coût : un SMS contenant des caractères hors GSM (certains accents, `œ`) est découpé en plusieurs parties facturées séparément. Les SMS de l'app font entre 120 et 160 caractères.

---

## 6. Recette en mode test

À faire sur ton téléphone, avec l'URL de production et Stripe en mode test.

- [ ] **Connexion** : `/login`, recevoir l'e-mail, cliquer le lien. On arrive sur l'écran « Bienvenue ».
- [ ] **Profil** : nom, SIRET, adresse, n° TVA, assurance décennale, puis « Continuer ». On arrive sur l'accueil, qui affiche le bandeau « Paiements en ligne non activés ».
- [ ] **Stripe Connect** : Réglages → « Activer les paiements ». Remplir le formulaire Stripe avec les données de test (Stripe propose « Use test data »). Au retour, on doit lire « Activés » et le bandeau disparaît.
  - Si le statut reste « incomplet », vérifier dans Stripe que le webhook 2 reçoit bien `account.updated`.
- [ ] **Devis par SMS** : un devis vers **ton** numéro, puis « Envoyer par SMS ». Le SMS doit arriver avec un lien `https://<domaine>/s/…`.
- [ ] **Signature à distance** : ouvrir le lien, signer. Le message « Devis signé » s'affiche avec un bouton vert « Payer ».
- [ ] **Paiement** : carte `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVC. La facture doit passer en « Payé » dans l'onglet « Payés » de l'accueil.
  - Sinon, voir **Stripe → Webhooks → webhook 2 → tentatives** : un code 400 signale un mauvais secret, un code 500 une erreur base de données.
- [ ] **Signature sur place** : un devis → « Faire signer sur place » → signer au doigt. La facture `F-AAAA-0001` s'affiche → « Générer le lien de paiement » → « Envoyer le lien par SMS ».
- [ ] **PDF** : l'icône en haut de la facture ouvre un PDF avec les mentions et la signature. Le bouton « PDF » de la page client fonctionne aussi.
- [ ] **Relance manuelle** : « Relancer par SMS » sur l'accueil. Le bouton affiche « Relance envoyée » et le SMS arrive.
- [ ] **Cron** : le déclencher à la main.
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<domaine>/api/cron/relances
  # → {"checked":…,"sent":…,"failed":[]}
  curl https://<domaine>/api/cron/relances   # sans secret → 401
  ```
  Pour tester une relance J+3 sans attendre 3 jours, reculer la date de signature d'une facture de test dans le SQL Editor :
  ```sql
  update invoices set signed_at = now() - interval '4 days'
  where invoice_number = 'F-2026-0001';
  ```
- [ ] **PWA** :
  - Android / Chrome : menu → « Installer l'application ».
  - iPhone / Safari : Partager → « Sur l'écran d'accueil ».
  - Vérifier que l'icône s'affiche et que l'app s'ouvre en plein écran.
- [ ] **Hors ligne** : ouvrir l'accueil et une facture, passer en mode avion, rouvrir l'app. Les données s'affichent avec le bandeau « Hors ligne ».
- [ ] **Déconnexion** : Réglages → « Se déconnecter ». On revient sur `/login`.

---

## 7. Sécurité : vérifications rapides

- [ ] Sans être connecté, `https://<domaine>/` redirige vers `/login`, alors que `/sw.js` et `/manifest.webmanifest` répondent 200.
- [ ] Dans le code JS téléchargé par le navigateur (DevTools → Sources), on ne trouve **ni** `SUPABASE_SERVICE_ROLE_KEY`, **ni** `sk_`, **ni** le token Twilio.
- [ ] Un lien `/s/<jeton-inventé>` renvoie 404.
- [ ] **Supabase → Advisors → Security** : aucune alerte « RLS disabled ».

---

## 8. Passage en production

- [ ] **Stripe** : terminer l'activation du compte plateforme (entreprise, IBAN), puis passer en mode **live**.
  - Recréer les **deux webhooks** en live : les secrets sont différents de ceux du mode test.
  - Remplacer `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET` et `STRIPE_CONNECT_WEBHOOK_SECRET`.
  - ⚠️ Les comptes Connect créés en mode test n'existent pas en live. Côté base, remettre à zéro `stripe_account_id` et `stripe_charges_enabled` des profils de test, ou repartir d'une base vide.
- [ ] **Twilio** : passer le compte en payant et finaliser l'expéditeur (section 5).
- [ ] **SMTP** configuré (section 2.4).
- [ ] Redéployer sur Vercel.
- [ ] Refaire rapidement le parcours de la section 6 avec un vrai paiement de 1 €, puis le rembourser dans Stripe.
- [ ] **Juridique** (à valider avec un juriste ou un expert-comptable) :
  - mentions légales et CGU du service ;
  - politique de confidentialité (RGPD) : l'app stocke les noms, téléphones, adresses, signatures et IP des clients des artisans ;
  - contrat de sous-traitance RGPD avec les artisans, qui sont responsables de traitement pour les données de leurs clients ;
  - relire le texte « Devis gratuit, valable 30 jours » du PDF, à rendre configurable si certains artisans font payer leurs devis.

---

## 9. Après la mise en ligne

- [ ] **Vercel → Logs**, filtrer sur `/api/cron/relances` : le cron tourne chaque jour, et `failed` doit rester vide.
- [ ] **Stripe → Webhooks** : aucun événement en échec. Stripe relance automatiquement pendant 3 jours.
- [ ] **Twilio → Monitor → Logs** : surveiller les SMS non délivrés (numéro invalide, opérateur qui filtre).
- [ ] **Supabase → Database → Backups** : sauvegardes quotidiennes incluses dans le plan Pro. En plan gratuit, il n'y en a pas : prévoir un `pg_dump` régulier ou passer en Pro avant d'avoir de vraies factures.
- [ ] **Nouvelle version du service worker** : si tu modifies `public/sw.js`, incrémente `VERSION` (`v1` → `v2`) pour vider l'ancien cache des fichiers statiques.
