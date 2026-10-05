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

- [ ] Créer le projet dans la région **Canada (Central, `ca-central-1`)**. Les données des clients (téléphones, signatures, IP) restent ainsi au Canada (Loi 25).
- [ ] Appliquer les 10 migrations **dans l'ordre**, avec l'une des deux méthodes :
  - CLI :
    ```bash
    supabase link --project-ref <ref>
    supabase db push
    ```
  - SQL Editor : coller et exécuter `0001_init.sql`, `0002_signatures.sql`, `0003_profile_stripe.sql`, `0004_legal_mentions.sql`, `0005_quebec_taxes.sql`, `0006_quebec_identifiers.sql`, `0007_soumissions.sql`, `0008_offline_signature.sql`, `0009_platform_fee.sql`, puis `0010_platform_fee_taxes.sql`.
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

- [ ] **Authentication → Sign In / Providers → Email** : activé. Connexion par **e-mail + mot de passe** ; le lien par e-mail reste proposé (comptes sans mot de passe, première connexion). Les mots de passe se définissent dans Réglages → « Mot de passe » (8 caractères minimum ; Supabase peut imposer davantage dans *Password requirements*).
- [ ] **Authentication → URL Configuration** :
  - Site URL : `https://<domaine>`
  - Redirect URLs : `https://<domaine>/auth/callback` (lien de connexion) `https://<domaine>/auth/reset` (mot de passe oublié) **et** `https://<domaine>/auth/email` (changement d'adresse e-mail). Ajouter aussi les équivalents `http://localhost:3000/…` pour le développement.
  - ⚠️ Sans `/auth/reset` ou `/auth/email` dans cette liste, Supabase refuse la redirection et le lien « mot de passe oublié » ou de confirmation d'adresse ne mène pas à l'app.
- [ ] **Authentication → Sign In / Providers → Email → Secure email change** : laisser activé (par défaut). Un changement d'adresse doit alors être confirmé depuis l'ancienne **et** la nouvelle adresse ; Réglages l'explique à l'artisan.
- [ ] **Templates d'e-mail** (Authentication → Emails → Templates) : coller les modèles français du dossier [`supabase/templates/`](../supabase/templates/), tels quels (Supabase remplit `{{ .ConfirmationURL }}` et `{{ .Email }}`).
  - **Magic Link** (lien de connexion, compte existant) : objet « Votre lien de connexion », corps = [`lien-de-connexion.html`](../supabase/templates/lien-de-connexion.html).
  - **Confirm signup** (lien de connexion, première fois : Supabase envoie ce modèle-là quand le compte n'existe pas encore) : objet « Bienvenue sur Chantier : confirmez votre adresse », corps = [`confirmation-inscription.html`](../supabase/templates/confirmation-inscription.html).
  - **Reset Password** : objet « Choisissez un nouveau mot de passe », corps = contenu de [`supabase/templates/reinitialisation-mot-de-passe.html`](../supabase/templates/reinitialisation-mot-de-passe.html), à coller tel quel (les variables `{{ .ConfirmationURL }}` et `{{ .Email }}` sont remplies par Supabase). Le lien expire selon *Email OTP Expiration* (1 h par défaut).
  - **Change Email Address** : objet « Confirmez votre nouvelle adresse e-mail », corps = [`changement-adresse.html`](../supabase/templates/changement-adresse.html). Il utilise aussi `{{ .NewEmail }}`. Envoyé quand l'artisan change d'adresse dans Réglages → « Adresse e-mail ».
- [ ] **SMTP personnalisé (indispensable avant de vrais utilisateurs).** L'envoi d'e-mails intégré à Supabase est limité à quelques messages par heure et réservé aux tests. Configurer un fournisseur dans **Authentication → Emails → SMTP Settings**, avec un expéditeur sur ton domaine (SPF/DKIM configurés).

---

## 3. Vercel : application

- [ ] Importer le dépôt GitHub. Framework : Next.js, détecté automatiquement.
- [ ] **Settings → Functions → Region** : `yul1` (Montréal), près de la base Supabase.
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
  | `PLATFORM_FEE_BPS` | section 4, commission (vide = aucune) |
  | `PLATFORM_FEE_FIXED_CENTS` | section 4, commission (facultatif) |
  | `PLATFORM_TPS_NUMBER` | section 4, si la plateforme est inscrite |
  | `PLATFORM_TVQ_NUMBER` | section 4, si la plateforme est inscrite |
  | `PLATFORM_LEGAL_NAME` | nom légal imprimé sur les relevés de commissions |
  | `PLATFORM_ADDRESS` | adresse imprimée sur les relevés de commissions |
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
- [ ] **Cron** : **Settings → Cron Jobs** doit afficher `/api/cron/relances`, chaque jour à 14 h UTC (10 h à Montréal l'été, 9 h l'hiver). Vercel ajoute tout seul l'en-tête `Authorization: Bearer $CRON_SECRET`.

---

## 4. Stripe : paiements et Connect

Commencer en **mode test** : le sélecteur est en haut à droite du dashboard Stripe.

- [ ] **Activer Connect** (**Connect → Get started**) et choisir le modèle « plateforme ». Les artisans auront des comptes **Standard** canadiens (`country: "CA"`) : ils reçoivent l'argent directement sur leur compte, en dollars canadiens.
- [ ] Ton compte Stripe plateforme doit pouvoir créer des comptes connectés au Canada. C'est le cas le plus simple avec un compte plateforme canadien ; sinon, vérifier les conditions « cross-border » de Stripe Connect.
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
- [ ] **Commission de la plateforme** : définir `PLATFORM_FEE_BPS` (ex. `100` = 1 %) et, si voulu, `PLATFORM_FEE_FIXED_CENTS` (ex. `30` = 0,30 $) dans Vercel, puis redéployer. Sans ces variables, aucune commission n'est prélevée.
  - Vérifier dans Stripe (**Connect → Collected fees**) que la commission arrive après un paiement de test.
  - **TPS / TVQ sur la commission** : si la plateforme est inscrite, définir `PLATFORM_TPS_NUMBER` et `PLATFORM_TVQ_NUMBER`. Les taxes sont alors ajoutées à la commission et le détail est affiché à l'artisan pour ses crédits de taxe. Faire valider par un comptable (inscription, lieu de fourniture, document à remettre aux artisans).

---

## 5. Twilio : SMS

- [ ] **Messaging → Settings → Geo permissions** : autoriser **Canada**, plus les autres pays de tes clients.
- [ ] **Expéditeur des SMS.** Les règles françaises évoluent régulièrement, donc les vérifier dans la console Twilio au moment de l'inscription. Deux options :
  - **Numéro local canadien** (+1, indicatif 514, 438, 450…) acheté chez Twilio : le plus simple, et le client peut répondre.
  - **Numéro sans frais** (+1 8XX) : meilleure délivrabilité en volume, mais une vérification (toll-free verification) est exigée avant l'envoi.
  - Les Sender ID alphanumériques (ex. `Chantier`) ne sont pas pris en charge au Canada.
- [ ] Remplir `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, et `TWILIO_FROM_NUMBER` (au format `+1…`).
- [ ] Compte d'essai : il n'envoie qu'aux numéros vérifiés. Ajouter ton portable dans **Verified Caller IDs** pour la recette.
- [ ] Coût : un SMS contenant des caractères hors GSM (certains accents, `œ`) est découpé en plusieurs parties facturées séparément. Les SMS de l'app font entre 120 et 160 caractères.

---

## 6. Recette en mode test

À faire sur ton téléphone, avec l'URL de production et Stripe en mode test.

- [ ] **Connexion** : `/login` → « Recevoir un lien par e-mail », cliquer le lien. On arrive sur l'écran « Bienvenue ».
- [ ] **Mot de passe** : Réglages → « Mot de passe » → enregistrer ; se déconnecter ; se reconnecter avec e-mail + mot de passe. Un mauvais mot de passe affiche « E-mail ou mot de passe incorrect. »
- [ ] **Mot de passe oublié** : sur la page de connexion, saisir l'e-mail → « Mot de passe oublié ? ». Ouvrir l'e-mail **sur le même téléphone**, choisir un nouveau mot de passe : on arrive connecté sur l'accueil. L'ancien mot de passe ne fonctionne plus.
- [ ] **Changement d'adresse** : Réglages → « Adresse e-mail » → saisir une autre adresse → « Changer d'adresse ». Le bloc « Changement en attente » apparaît. Ouvrir les e-mails de confirmation (ancienne et nouvelle adresse, sur le même téléphone) : Réglages affiche « Adresse e-mail changée » et la nouvelle adresse. Se reconnecter ensuite avec la nouvelle adresse et le même mot de passe ; l'ancienne ne fonctionne plus.
- [ ] **Suppression du compte** (à faire en dernier, ou avec un second compte de test) : Réglages → « Supprimer mon compte » → taper `SUPPRIMER`. On arrive sur la connexion avec « Votre compte a été supprimé ». Dans Supabase, l'utilisateur, son profil, ses clients et ses soumissions ont disparu, ainsi que son dossier `signatures/<id>` ; dans Stripe, ses liens de paiement non payés sont désactivés et son compte connecté est toujours là (il appartient à l'artisan).
- [ ] **Profil** : nom, adresse, NEQ, licence RBQ, n° de TPS (`123456789 RT0001`) et de TVQ (`1234567890 TQ0001`), assurance, puis « Continuer ». On arrive sur l'accueil, qui affiche le bandeau « Paiements en ligne non activés ».
- [ ] **Stripe Connect** : Réglages → « Activer les paiements ». Remplir le formulaire Stripe avec les données de test (Stripe propose « Use test data »). Au retour, on doit lire « Activés » et le bandeau disparaît.
  - Si le statut reste « incomplet », vérifier dans Stripe que le webhook 2 reçoit bien `account.updated`.
- [ ] **Soumission par SMS** : une soumission vers **ton** numéro, puis « Envoyer par SMS ». Le SMS doit arriver avec un lien `https://<domaine>/s/…`.
- [ ] **Signature à distance** : ouvrir le lien, signer. Le message « Soumission signée » s'affiche avec un bouton vert « Payer ».
- [ ] **Paiement** : carte `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVC. La facture doit passer en « Payée » dans l'onglet « Payées » de l'accueil.
  - Sinon, voir **Stripe → Webhooks → webhook 2 → tentatives** : un code 400 signale un mauvais secret, un code 500 une erreur base de données.
- [ ] **Signature sur place** : une soumission → « Faire signer sur place » → signer au doigt. La facture `F-AAAA-0001` s'affiche → « Générer le lien de paiement » → « Envoyer le lien par SMS ».
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
- [ ] **Signature hors ligne** : ouvrir l'app une fois en ligne, passer en mode avion, « Nouvelle soumission » → « Faire signer sur place » → signer. L'accueil affiche « En attente d'envoi ». Désactiver le mode avion et rouvrir l'app : la soumission apparaît comme facture « Signée (hors ligne) ».
- [ ] **Signature à distance hors ligne** : envoyer une soumission par SMS à ton numéro, ouvrir le lien une fois, passer en mode avion, signer. La page affiche « Signature enregistrée sur votre téléphone ». Désactiver le mode avion et rouvrir le lien : « Soumission signée. Merci. », et la facture apparaît dans l'app de l'artisan.
- [ ] **Relevé des commissions** : après un paiement de test, Réglages → « Relevés des commissions » → le mois en cours. Le PDF affiche le nom et l'adresse de la plateforme, ses n° de TPS / TVQ, le paiement et le détail de la commission.
- [ ] **Déconnexion** : Réglages → « Se déconnecter ». On revient sur `/login`.

---

## 7. Sécurité : vérifications rapides

- [ ] Sans être connecté, `https://<domaine>/` redirige vers `/login`, alors que `/sw.js` et `/manifest.webmanifest` répondent 200.
- [ ] Dans le code JS téléchargé par le navigateur (DevTools → Sources), on ne trouve **ni** `SUPABASE_SERVICE_ROLE_KEY`, **ni** `sk_`, **ni** le token Twilio.
- [ ] Un lien `/s/<jeton-inventé>` renvoie 404.
- [ ] **Supabase → Advisors → Security** : aucune alerte « RLS disabled ».

---

## 8. Passage en production

- [ ] **Stripe** : terminer l'activation du compte plateforme (entreprise, coordonnées bancaires), puis passer en mode **live**.
  - Recréer les **deux webhooks** en live : les secrets sont différents de ceux du mode test.
  - Remplacer `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET` et `STRIPE_CONNECT_WEBHOOK_SECRET`.
  - ⚠️ Les comptes Connect créés en mode test n'existent pas en live. Côté base, remettre à zéro `stripe_account_id` et `stripe_charges_enabled` des profils de test, ou repartir d'une base vide.
- [ ] **Twilio** : passer le compte en payant et finaliser l'expéditeur (section 5).
- [ ] **SMTP** configuré (section 2).
- [ ] Redéployer sur Vercel.
- [ ] Refaire rapidement le parcours de la section 6 avec un vrai paiement de 1 $, puis le rembourser dans Stripe.
- [ ] **Juridique** (à valider avec un juriste ou un expert-comptable) :
  - mentions légales et CGU du service ;
  - politique de confidentialité conforme à la **Loi 25** (Québec) et à la LPRPDE : l'app stocke les noms, téléphones, adresses, signatures et IP des clients des artisans ;
  - désigner un responsable de la protection des renseignements personnels, et encadrer par contrat le traitement des données des clients des artisans ;
  - faire valider les mentions du PDF (NEQ, licence RBQ, n° de TPS / TVQ, « Soumission valable 30 jours ») au regard de la Loi sur le bâtiment et de la Loi sur la protection du consommateur.

---

## 9. Après la mise en ligne

- [ ] **Vercel → Logs**, filtrer sur `/api/cron/relances` : le cron tourne chaque jour, et `failed` doit rester vide.
- [ ] **Stripe → Webhooks** : aucun événement en échec. Stripe relance automatiquement pendant 3 jours.
- [ ] **Twilio → Monitor → Logs** : surveiller les SMS non délivrés (numéro invalide, opérateur qui filtre).
- [ ] **Supabase → Database → Backups** : sauvegardes quotidiennes incluses dans le plan Pro. En plan gratuit, il n'y en a pas : prévoir un `pg_dump` régulier ou passer en Pro avant d'avoir de vraies factures.
- [ ] **Nouvelle version du service worker** : si tu modifies `public/sw.js`, incrémente `VERSION` (`v1` → `v2`) pour vider l'ancien cache des fichiers statiques.
