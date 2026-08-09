# Deploiement de BlueCare

Procedure complete pour mettre l application en ligne : base Supabase, API Node,
interface sur Netlify.

Compter une heure la premiere fois. Les etapes sont dans l ordre : la base
d abord, l API ensuite, l interface en dernier — chacune a besoin de la
precedente.

---

## 1. Comprendre l architecture avant de commencer

```
   Navigateur
       |
       |  https://votre-centre.netlify.app
       v
   Netlify  ──────────────  interface React (fichiers statiques)
       |
       |  /api/*  relaye (proxy, meme origine)
       v
   Serveur Node  ────────  API Express (Render, Railway, Fly.io...)
       |
       |  clef service_role
       v
   Supabase  ────────────  PostgreSQL (les donnees)
```

**Netlify ne peut pas heberger l API.** Netlify sert des fichiers statiques ; le
backend BlueCare est un serveur Express qui tourne en continu, garde des
sessions et diffuse des PDF. Il lui faut un hebergeur Node. Les exemples
ci-dessous utilisent **Render** (offre gratuite suffisante pour demarrer), mais
Railway, Fly.io ou un VPS conviennent aussi bien.

**Pourquoi le relais `/api/*` sur Netlify est obligatoire.** Le cookie de
session est `SameSite=Strict` : le navigateur ne l envoie qu aux requetes de la
meme origine. Si l interface appelait directement `https://api.exemple.com`,
le cookie ne partirait jamais et la connexion echouerait — sans message
d erreur explicite, ce qui est le pire des cas a diagnostiquer. Le relais
declare dans `netlify.toml` fait que tout se joue sur le domaine Netlify.

---

## 2. Base de donnees Supabase

### 2.1 Creer le projet

1. Ouvrir [supabase.com](https://supabase.com) et creer un compte.
2. **New project**. Renseigner :
   - un nom (`bluecare-papillon-bleu`),
   - un mot de passe de base de donnees — le conserver dans un gestionnaire de
     mots de passe, il n est plus affiche ensuite,
   - une region **proche des utilisateurs** (`Europe West` pour la France).
3. Attendre la fin du provisionnement (une a deux minutes).

### 2.2 Creer les tables

1. Dashboard > **SQL Editor** > **New query**.
2. Coller l integralite de [`backend/supabase/schema.sql`](backend/supabase/schema.sql).
3. **Run**.

Le script est idempotent (`create table if not exists`) : le relancer ne detruit
rien. Il cree les tables, les contraintes metier, les index et les politiques
RLS.

Verifier dans **Table Editor** que les douze tables sont la : `users`,
`auth_sessions`, `children`, `attendance`, `activities`, `goals`, `sessions`,
`reports`, `medications`, `medication_administrations`, `notification_reads` et
`push_subscriptions`.

### 2.3 Recuperer les clefs

Dashboard > **Project Settings** > **Data API** (ou **API** selon la version) :

| Valeur affichee     | Variable                    | Nature                                    |
| ------------------- | --------------------------- | ----------------------------------------- |
| Project URL         | `SUPABASE_URL`              | Publique                                  |
| `service_role` key  | `SUPABASE_SERVICE_ROLE_KEY` | **Secrete** — acces total, ignore la RLS   |
| `anon` key          | `SUPABASE_ANON_KEY`         | Publique, inutilisee ici                   |

> **La clef `service_role` ne doit jamais atteindre le navigateur.** Elle
> contourne toutes les politiques RLS : qui la detient lit et modifie l integralite
> du dossier de chaque enfant. Elle vit uniquement dans les variables
> d environnement du serveur Node. Ne jamais la prefixer `VITE_`, ne jamais la
> committer, ne jamais la coller dans `.env.example`.
>
> BlueCare n a pas besoin de `SUPABASE_ANON_KEY` : l interface ne parle jamais
> directement a Supabase, toujours a l API.

### 2.4 Ce que la RLS protege ici

Le backend se connecte avec `service_role`, qui passe outre la RLS — le controle
d acces reel est fait par l application (`middlewares/authorize.js` pour les
routes, `services/access.service.js` pour le perimetre par enfant).

Les politiques RLS du schema sont une **seconde barriere** : elles limitent les
degats si quelqu un obtenait un jour la clef `anon` et tentait d attaquer la base
directement. Ne pas les desactiver.

---

## 3. API Node

### 3.1 Deposer le code

Le depot doit etre accessible a l hebergeur (GitHub, GitLab). Pousser la branche
a deployer.

### 3.2 Creer le service (exemple Render)

1. [render.com](https://render.com) > **New** > **Web Service**, connecter le depot.
2. Configurer :

   | Champ           | Valeur                       |
   | --------------- | ---------------------------- |
   | Root Directory  | *(laisser vide — monorepo)*  |
   | Runtime         | Node                         |
   | Build Command   | `npm install`                |
   | Start Command   | `npm start`                  |
   | Health Check    | `/api/health`                |

`npm start` a la racine lance `npm run start --workspace backend`, donc
`node src/server.js`.

### 3.3 Variables d environnement

A saisir dans l onglet **Environment** de l hebergeur. Ne jamais deposer de
fichier `.env` dans le depot.

```bash
NODE_ENV=production
PORT=3000                       # souvent impose par l hebergeur

# Origine autorisee : l URL exacte du site Netlify, sans barre finale
CORS_ORIGIN=https://votre-centre.netlify.app

# Adresse publique du front. Elle sert a construire les liens de
# reinitialisation envoyes par courriel : une valeur fausse produit des liens
# qui ne menent nulle part.
APP_URL=https://votre-centre.netlify.app

# Secret des jetons sans etat (lien famille, defi 2FA).
# Generer : node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=<48 octets aleatoires>

# Sel des alias de la galerie anonymisee. A FIXER UNE FOIS POUR TOUTES :
# le changer renomme tous les alias deja affiches aux familles.
ANONYMIZATION_SALT=<chaine aleatoire>

# Base de donnees
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<clef service_role>

# Jamais de donnees de demonstration en ligne
SEED_DEMO_DATA=false
```

Reglages facultatifs : `BCRYPT_ROUNDS`, `MIN_PASSWORD_LENGTH`,
`PASSWORD_RESET_TTL_MINUTES`, `FAMILY_LINK_TTL`, les seuils d absences et de
comptes-rendus. Voir [`backend/.env.example`](backend/.env.example).

### 3.4 Deux garde-fous au demarrage

Le serveur **refuse de demarrer** en production si :

- `JWT_SECRET` est absent — plutot que de signer avec une clef de developpement
  connue de quiconque a lu le depot ;
- les clefs Supabase sont absentes — sinon l application tournerait sur le
  stockage en memoire : elle repondrait normalement, les equipes saisiraient des
  presences et des comptes-rendus, et **tout disparaitrait au premier
  redemarrage**, sans le moindre message d erreur.

Un demarrage qui echoue avec un message clair vaut mieux qu une application qui
perd le travail de la journee en silence.

### 3.5 Verifier

```bash
curl https://votre-backend.onrender.com/api/health
# {"status":"ok","data":{"storage":"supabase", ...}}
```

`storage` doit valoir `supabase`. S il vaut `memory`, les clefs ne sont pas
lues : reprendre l etape 3.3.

---

## 4. Envoi des courriels

**Aucun fournisseur n est branche.** En production, le transport par defaut
**leve une erreur** au lieu de faire croire qu un message est parti — un lien de
reinitialisation qui n arrive jamais est pire qu une erreur visible.

Tant que rien n est configure, « Mot de passe oublie » ne fonctionne pas en
ligne. La direction peut toujours reinitialiser un mot de passe depuis la
gestion des comptes, donc ce n est pas bloquant pour ouvrir le service.

Pour l activer : choisir un service (Resend, Postmark, SendGrid, ou un SMTP
existant) et remplacer le transport dans
[`backend/src/utils/mailer.js`](backend/src/utils/mailer.js). C est le seul
endroit de l application qui envoie du courriel — rien d autre n est a modifier.

---

## 5. Premier compte

Une base fraiche est vide, et les comptes se creent depuis l application... ou il
faut deja etre directeur. Ce script est la porte d entree, et ne sert qu une fois.

Depuis un poste local, avec `backend/.env` pointant vers la base **de
production** :

```bash
ADMIN_EMAIL=direction@centre.fr \
ADMIN_PASSWORD='un mot de passe long et unique' \
ADMIN_FIRST_NAME=Awa \
ADMIN_LAST_NAME=Diallo \
npm run create-admin --workspace backend
```

Le script refuse d ecraser un compte existant. Se connecter ensuite, **activer
la double authentification** depuis « Mon profil », puis creer les comptes de
l equipe depuis l ecran de gestion.

> **Ne jamais lancer `npm run seed` sur la base de production.** Il y creerait
> les comptes de demonstration, dont les mots de passe sont ecrits en clair dans
> le depot et dans le README. Le script refuse de tourner quand
> `NODE_ENV=production`, mais rien ne l empeche de viser une base de production
> depuis un poste local ou `NODE_ENV` vaut `development` : c est a vous de
> verifier vers quelle base pointe votre `.env`.

---

## 6. Interface sur Netlify

### 6.1 Renseigner l URL de l API

Ouvrir [`netlify.toml`](netlify.toml) a la racine et remplacer le domaine :

```toml
[[redirects]]
  from = "/api/*"
  to = "https://votre-backend.onrender.com/api/:splat"
  status = 200
  force = true
```

Committer la modification.

### 6.2 Creer le site

1. [netlify.com](https://netlify.com) > **Add new site** > **Import an existing project**.
2. Choisir le depot et la branche.
3. Netlify lit `netlify.toml` : la commande (`npm run build`) et le dossier
   publie (`frontend/dist`) sont deja renseignes, ne pas les surcharger.
4. **Deploy site**.

Aucune variable d environnement n est necessaire cote Netlify : l interface ne
detient aucun secret et appelle `/api` sur sa propre origine.

### 6.3 Boucler la configuration

Une fois l URL definitive connue (`https://votre-centre.netlify.app`, ou votre
domaine si vous en branchez un), revenir mettre a jour `CORS_ORIGIN` et
`APP_URL` cote backend (etape 3.3), puis redemarrer le service. Ces deux
variables doivent correspondre **exactement** a l URL du site, sans barre finale.

---

## 7. Verification apres mise en ligne

A derouler dans le navigateur, sur le site en ligne :

- [ ] `https://votre-centre.netlify.app` affiche l ecran de connexion.
- [ ] Se connecter avec le compte cree a l etape 5.
- [ ] Rafraichir une page profonde (`/enfants`) : elle se recharge sans 404.
- [ ] **Fermer l onglet, rouvrir le site** : la session tient toujours (le cookie
      fonctionne — c est ce que valide le relais `/api/*`).
- [ ] Le bouton **Deconnexion** du menu ramene a l ecran de connexion.
- [ ] Creer un enfant, saisir une presence.
- [ ] **Redemarrer le service backend**, recharger : la donnee est toujours la.
      C est la preuve que Supabase est bien utilise et non le stockage en memoire.
- [ ] Activer la double authentification sur le compte de direction.
- [ ] Exporter un PDF de progression.

Si la connexion echoue alors que les identifiants sont bons, c est presque
toujours le relais `/api/*` : verifier l URL dans `netlify.toml`, puis que
`CORS_ORIGIN` correspond au domaine Netlify.

---

## 8. Avant d accueillir de vraies donnees

L application manipule des donnees de sante d enfants mineurs. Trois points
depassent la technique et relevent d une decision du centre :

- **Sauvegardes.** Verifier la retention des sauvegardes du plan Supabase choisi
  (l offre gratuite conserve peu). Une base de dossiers d enfants sans
  sauvegarde eprouvee est un risque, pas une economie.
- **Hebergement des donnees de sante.** En France, l hebergement de donnees de
  sante a caractere personnel releve de la certification HDS. Verifier ce que
  cela implique pour le centre avant toute mise en service reelle.
- **Registre RGPD.** Duree de conservation, information des familles, droit
  d acces et de suppression.

Cote technique, avant l ouverture :

- [ ] `service_role` absente du depot et des variables Netlify.
- [ ] `SEED_DEMO_DATA=false` et aucun compte `@papillonbleu.test` en base.
- [ ] Double authentification active sur tous les comptes de direction.
- [ ] `ANONYMIZATION_SALT` fixe definitivement.
- [ ] Transport de courriel configure (etape 4).

---

## Depannage

| Symptome                                         | Cause probable                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Connexion acceptee puis immediatement deconnecte | Relais `/api/*` absent ou faux : le cookie `SameSite=Strict` ne part pas |
| 404 en rafraichissant une page                   | Regle SPA absente de `netlify.toml`                                    |
| Le backend refuse de demarrer                    | `JWT_SECRET` ou clefs Supabase manquantes — lire le message, il est explicite |
| Les donnees disparaissent au redemarrage         | `storage: memory` sur `/api/health` : clefs Supabase non lues          |
| « Mot de passe oublie » renvoie une erreur       | Aucun transport de courriel configure (etape 4)                        |
| Liens de reinitialisation vers `localhost`       | `APP_URL` non renseignee cote backend                                  |
| 403 sur toutes les requetes                      | `CORS_ORIGIN` ne correspond pas exactement au domaine Netlify          |
