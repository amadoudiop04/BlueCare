<div align="center">

<img src="frontend/public/logoPapillonBleu.png" alt="BlueCare" width="88" />

# BlueCare

**Le suivi quotidien d'un centre d'accueil pour enfants en situation de handicap.**
Présences, objectifs pédagogiques, comptes rendus de séance, traitements, rapports aux familles.

[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020.19-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/tests-176%20passants-14866B)](#tests)

</div>

---

## Sommaire

- [Ce que fait l'application](#ce-que-fait-lapplication)
- [Démarrage en trois minutes](#démarrage-en-trois-minutes)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Structure du dépôt](#structure-du-dépôt)
- [Conventions de code](#conventions-de-code)
- [Rapidité et confort d'usage](#rapidité-et-confort-dusage)
- [Documentation de l'API](#documentation-de-lapi)
- [Stockage](#stockage)
- [Tests](#tests)
- [Essayer l'API à la main](#essayer-lapi-à-la-main)
- [Ajouter une ressource](#ajouter-une-ressource)
- [Mise en ligne](#mise-en-ligne)

---

## Ce que fait l'application

Quatre métiers travaillent sur les mêmes enfants sans voir les mêmes choses. C'est
tout le sujet de l'application, et la raison d'être de son modèle de droits.

| Rôle | Périmètre | Ce qu'il peut faire |
| --- | --- | --- |
| **Éducateur** | les enfants de ses groupes | inscrire un enfant dans ses groupes, présences, activités, objectifs, séances, comptes rendus |
| **Infirmière** | tout le centre | données médicales, traitements, rappels, alertes de santé |
| **Direction** | tout le centre | tout, plus le tableau de bord, les exports et la gestion des comptes |
| **Famille** | ses propres enfants | **lecture seule** : progression, objectifs, galerie, export PDF |

Le médecin référent n'est visible que par l'infirmière et la direction. Les séances et
comptes rendus restent internes : une famille reçoit la progression, pas les observations
brutes de l'équipe.

**Les fonctionnalités qui font le quotidien**

- **Feuille d'appel** par groupe, avec quatre statuts et des **alertes d'absences
  recalculées à chaque lecture** — corriger une saisie fait disparaître son alerte.
- **Objectifs personnalisés** dont l'avancement se met à jour tout seul au dépôt d'un
  compte rendu : les courbes se remplissent **sans double saisie**.
- **Courbes d'évolution sur six mois**, par objectif et par humeur, agrégées côté serveur.
- **Galerie d'activités anonymisée** : sur la fiche d'un enfant, les autres participants
  deviennent `Enfant #A3F1`, y compris dans les titres et les légendes.
- **Traitements et rappels de prise**, réservés à l'infirmière et à la direction.
- **Rapport PDF de progression** destiné aux familles, généré à la volée.
- **Lien de suivi famille** valable sept jours, consultable sans compte.
- **Double authentification TOTP** implémentée sans dépendance, avec codes de secours.

---

## Démarrage en trois minutes

**Prérequis** — Node.js ≥ 20.19 et npm ≥ 10.

```bash
git clone https://github.com/amadoudiop04/BlueCare.git
cd BlueCare

npm install                       # installe frontend + backend en une fois
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

npm run dev                       # lance l'API et l'interface en parallèle
```

| | |
| --- | --- |
| Interface | <http://localhost:5173> |
| API | <http://localhost:3000/api/health> |

Sans clés Supabase, l'application démarre sur un **stockage en mémoire** avec un jeu de
démonstration complet : cinq enfants, sept semaines de présences, six mois d'objectifs.
De quoi voir les alertes et les courbes dès le premier lancement. Les identifiants sont
dans [COMPTES-DE-TEST.md](COMPTES-DE-TEST.md).

Pour persister les données, voir [Brancher Supabase](#brancher-supabase).

> En développement, l'interface appelle `/api/...` et Vite relaie vers Express (voir
> `frontend/vite.config.js`). Les URL sont donc les mêmes en développement qu'en
> production, et aucune configuration CORS n'est nécessaire.

---

## Scripts

Tous à la racine du dépôt.

| Commande | Effet |
| --- | --- |
| `npm run dev` | Lance backend + frontend en parallèle |
| `npm run dev:frontend` | Lance uniquement Vite |
| `npm run dev:backend` | Lance uniquement l'API (avec `--watch`) |
| `npm run build` | Build de production de l'interface (`frontend/dist`) |
| `npm start` | Démarre l'API en mode production |
| `npm run lint` | ESLint sur les deux workspaces |
| `npm test` | Tests des deux workspaces |

Côté backend :

| Commande | Effet |
| --- | --- |
| `npm run seed --workspace backend` | Jeu de démonstration — **jamais en production** |
| `npm run create-admin --workspace backend` | Premier compte de direction d'une base vierge |

Pour cibler un workspace : `npm run <script> --workspace frontend`.

---

## Architecture

```
   Navigateur
       │
       │  interface React (Vite + Tailwind)
       ▼
   API Express  ──── route → controller → service → model
       │
       │  clé service_role
       ▼
   PostgreSQL (Supabase)  ──── contraintes métier + policies RLS
```

Monorepo npm workspaces : `frontend/` et `backend/`, une seule commande
d'installation, un seul `npm run dev`.

**Ce qui n'est pas dans le code, mais dans la base.** Le schéma porte les règles
métier en contraintes, pas seulement dans l'application : une présence par enfant et
par jour, un compte rendu par séance, un objectif atteint à 100 %, une absence
justifiée a un motif. Il inclut aussi les **policies RLS** qui rejouent le périmètre de
chaque rôle.

---

## Structure du dépôt

```
BlueCare/
├── package.json            # workspaces + scripts d'orchestration
├── frontend/
│   ├── index.html
│   ├── vite.config.js      # alias @ → src, proxy /api → backend, découpage des chunks
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/             # fichiers servis tels quels (favicon…)
│   └── src/
│       ├── main.jsx        # point d'entrée React
│       ├── App.jsx         # routage
│       ├── api/            # client HTTP + un fichier par domaine
│       ├── assets/         # images et polices importées depuis le code
│       ├── components/
│       │   ├── layout/     # structure de page (barre latérale, en-tête, palette…)
│       │   └── ui/         # composants génériques réutilisables
│       ├── features/       # modules métier autonomes
│       ├── hooks/          # hooks React partagés
│       ├── lib/            # helpers purs, sans React (cache, routes, formats…)
│       ├── pages/          # une page = une vue
│       └── styles/         # CSS global et directives Tailwind
└── backend/
    ├── .env.example
    ├── requests.http       # jeu de requêtes prêt à l'emploi
    ├── supabase/
    │   └── schema.sql      # tables, contraintes, index et policies RLS
    ├── tests/              # tests `node --test` (unitaires + bout en bout)
    └── src/
        ├── server.js       # démarrage HTTP uniquement
        ├── app.js          # construction de l'app Express (testable seule)
        ├── config/         # lecture et validation de l'environnement
        ├── constants/      # vocabulaire métier + rôles
        ├── routes/         # déclaration des URL et garde-fous par rôle
        ├── controllers/    # req/res → service → réponse
        ├── services/       # logique métier (ne connaît pas Express)
        ├── models/         # accès aux données
        ├── middlewares/    # authenticate, authorize, erreurs
        └── utils/          # logger, ApiError, jwt, password, validation, alertes
```

---

## Conventions de code

**Backend** — une requête traverse toujours `route → controller → service → model`.
Un controller ne contient pas de logique métier, un service ne touche pas à `req`/`res`.
Les controllers async sont enveloppés dans `asyncHandler` pour que leurs erreurs
remontent à `errorHandler`, seul endroit qui formate les réponses d'erreur.

**Frontend** — l'alias `@` pointe vers `src/`, donc on importe
`@/components/ui/Button.jsx` plutôt que `../../../components/ui/Button.jsx`.
Tout appel réseau passe par `src/api/client.js`.

**Environnement** — aucune variable en dur dans le code : côté backend on lit
`src/config/env.js`, côté frontend les variables préfixées `VITE_`. Les `.env` ne sont
pas versionnés, seuls les `.env.example` le sont. En production, `JWT_SECRET` est
obligatoire : sans lui le serveur refuse de démarrer, plutôt que de tourner avec une clé
connue de tous.

**Sécurité** — une route protégée déclare toujours `authenticate` puis `authorize(...)`.
Le service, lui, vérifie le périmètre via `requireChildAccess` : ne jamais se fier au seul
rôle pour décider qu'un enfant est accessible.

---

## Rapidité et confort d'usage

Le centre travaille sur des postes partagés et des téléphones, souvent en connexion
médiocre. Ce qui suit n'est pas de l'optimisation gratuite : c'est ce qui sépare une
application qu'on utilise d'une application qu'on subit.

**Ce qui est téléchargé**

- **Un fichier par écran** (`frontend/src/lib/routes.js`). L'ouverture de la page de
  connexion ne charge plus les dix-huit écrans, dont ceux qu'un éducateur ne verra
  jamais. React et le routeur ont leur propre fichier : ils ne changent qu'aux montées
  de version, le navigateur les garde donc en cache d'un déploiement à l'autre.
- **Préchargement au survol.** La barre latérale, les cartes enfant et la palette
  demandent le fichier de l'écran visé dès que le curseur s'y arrête — soit une centaine
  de millisecondes avant le clic. L'écran est en général déjà là quand on le demande.
- **L'animation three.js (~600 Ko) reste sur l'écran de connexion**, chargée à la
  demande : elle n'est jamais téléchargée par une session de travail.
- **Les polices ne bloquent plus le premier affichage** : l'interface apparaît
  immédiatement avec la police de repli, les caractères définitifs prennent la place à
  leur arrivée.

**Ce qui est demandé au serveur**

- **Cache stale-while-revalidate** (`frontend/src/lib/cache.js`) : revenir sur un écran
  déjà consulté réaffiche immédiatement son contenu, pendant qu'une requête discrète va
  chercher la version à jour. Il expire de lui-même, et il est **vidé à chaque
  changement de session** — sur un poste partagé, la fiche consultée par l'infirmière ne
  doit pas apparaître à l'éducateur qui se connecte après elle.
- **Requêtes parallèles.** Le tableau de bord lance ses six appels ensemble, la fiche
  enfant ses sept : ils ne coûtent plus que le plus lent d'entre eux, au lieu de
  s'enchaîner.
- **Référentiel mémorisé.** `GET /reference` est appelé par presque tous les écrans et
  ne bouge pas d'une minute à l'autre : il n'est demandé qu'une fois.
- **Réponses compressées** (gzip). Le JSON de cette API se compresse très bien, ses noms
  de champs se répétant à chaque ligne.

**Ce qui aide à se déplacer**

- **Palette de navigation `Ctrl K`** (`⌘K` sur Mac) : ouvrir la fiche d'un enfant
  demandait barre latérale, liste, recherche puis clic. Trois lettres du prénom
  suffisent désormais. Elle liste aussi les écrans et les actions d'écriture autorisées
  par le rôle. L'application **annonce le raccourci d'elle-même** à la première session —
  un raccourci que rien n'affiche n'existe que pour celui qui l'a codé. L'astuce
  disparaît définitivement dès qu'on la ferme ou, mieux, dès qu'on s'en sert.
- **Défilement remis en haut** à chaque changement d'écran, **lien d'évitement clavier**
  vers le contenu, et **barre de progression** pendant qu'un écran arrive — affichée
  après 120 ms seulement, pour ne pas clignoter quand le fichier est déjà là.
- **Barre latérale en tiroir** sous 1024 px, avec verrou de défilement sur le contenu
  qu'elle recouvre.

---

## Documentation de l'API

Toutes les réponses suivent la même forme :

```jsonc
// succès
{ "status": "ok", "data": …, "meta": … }
// erreur
{ "status": "error", "message": "…", "details": { "champ": ["…"] } }
```

<details>
<summary><b>Authentification et sessions</b></summary>

<br>

La session est **opaque et stockée en base**, portée par un cookie `httpOnly`,
`SameSite=Strict` (et `Secure` en production) que JavaScript ne peut ni lire ni écrire :
une injection de script n'a rien à voler, contrairement à un jeton rangé dans
`localStorage`. Seul le hachage SHA-256 du jeton est conservé — une copie de la base ne
permet pas de rejouer une session.

Les clients sans gestionnaire de cookies (tests, Postman, scripts) récupèrent le même
jeton dans `meta.sessionToken` et l'envoient en `Authorization: Bearer <jeton>`.

| Méthode | URL | Effet |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` → profil + session, ou défi 2FA |
| `POST` | `/api/auth/mfa/verify` | `{ challengeToken, code }` → ouvre la session |
| `POST` | `/api/auth/logout` | Ferme la session courante et efface le cookie |
| `GET` | `/api/auth/me` | Profil courant et périmètre (groupes, nombre d'enfants) |
| `PATCH` | `/api/auth/me` | Ses informations : nom, prénom, e-mail, téléphone |
| `POST` | `/api/auth/password` | Change son mot de passe (ancien exigé) |
| `GET` | `/api/auth/sessions` | Appareils connectés |
| `DELETE` | `/api/auth/sessions/:id` | Révoque une session à distance |

Routes ouvertes sans session : `/api/health`, `/api/auth/login`, `/api/auth/mfa/verify`,
`/api/auth/logout`, `/api/auth/password/*` et `/api/share/:token/...`.

Le mot de passe est haché avec bcrypt. La session a une expiration glissante et une
expiration absolue : elle se prolonge à l'usage, mais pas indéfiniment. Le périmètre est
relu en base à chaque requête, donc désactiver un compte ou changer une affectation prend
effet immédiatement.

Il reste deux jetons JWT, tous deux sans état et de portée étroite : le lien de suivi
famille et le défi de double authentification.

`PATCH /api/auth/me` ne touche ni au rôle ni au périmètre : personne ne se promeut
soi-même, ces deux champs restent dans la gestion des comptes. Le mot de passe courant
est exigé **dès que l'adresse e-mail change**, et elle seule : c'est elle qui reçoit les
liens de réinitialisation, donc la remplacer depuis une session volée suffirait à
s'emparer du compte.

À côté du cookie de session — `httpOnly`, invisible pour JavaScript — le serveur pose un
témoin `bluecare_signed_in`, lisible celui-là, sans aucun secret et de même durée. Il ne
sert qu'à répondre à une question que l'interface ne peut pas se poser autrement : y
a-t-il une session à restaurer ? Sans lui, chaque ouverture de l'écran de connexion
appelait `/auth/me` pour rien et laissait un `401` dans la console.

</details>

<details>
<summary><b>Mot de passe oublié</b></summary>

<br>

| Méthode | URL | Effet |
| --- | --- | --- |
| `POST` | `/api/auth/password/forgot` | `{ email }` → envoie un lien. Toujours `200` |
| `GET` | `/api/auth/password/reset/:token` | `{ valid, mfaRequired }` avant d'afficher le formulaire |
| `POST` | `/api/auth/password/reset/:token` | `{ password, code? }` → nouveau mot de passe |

La demande répond **toujours** `200`, que l'adresse existe ou non, et le temps de réponse
est aligné : ce formulaire ne doit pas permettre de découvrir qui travaille au centre.
Seul le hachage du jeton est stocké, le lien vaut une heure (`PASSWORD_RESET_TTL_MINUTES`),
ne sert qu'une fois, et en redemander un invalide le précédent.

**Le second facteur reste exigé quand il est actif** : sans cela, un accès à la boîte mail
suffirait à prendre le compte, ce qui viderait la double authentification de son sens —
c'est précisément ce scénario contre lequel elle protège. Un code de secours est accepté
à la place du code TOTP.

Une réinitialisation ferme **toutes** les sessions du compte, sur tous les appareils : si
le compte était compromis, changer le mot de passe sans déconnecter l'intrus ne servirait
à rien. Les demandes sont plafonnées à 5 par adresse et 60 par origine, par quart d'heure.

> Aucun fournisseur de courriel n'est branché — le centre n'en a pas encore choisi. En
> développement, le lien est écrit dans les logs du serveur. En production, le transport
> par défaut **échoue franchement** plutôt que de faire croire qu'un message est parti :
> brancher un vrai service dans `backend/src/utils/mailer.js`, seul endroit qui envoie
> des courriels.

</details>

<details>
<summary><b>Double authentification (TOTP)</b></summary>

<br>

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/auth/mfa` | État du second facteur sur son compte |
| `POST` | `/api/auth/mfa/setup` | Crée le secret et rend l'URI `otpauth://` à scanner |
| `POST` | `/api/auth/mfa/enable` | Confirme avec un code, puis rend les codes de secours |
| `POST` | `/api/auth/mfa/disable` | Désactive (mot de passe exigé) |

TOTP (RFC 6238) implémenté sans dépendance et vérifié contre les vecteurs de test de la
norme. L'activation exige un code valide : un scan raté ne peut pas enfermer quelqu'un
dehors. Les codes de secours sont hachés avec bcrypt et montrés une seule fois. Un pas
déjà consommé ne peut pas être rejoué, et le compte se verrouille après 5 échecs.

</details>

<details>
<summary><b>Rôles, périmètre et gestion des comptes</b></summary>

<br>

Deux contrôles se cumulent. `middlewares/authorize.js` décide **quelles routes** sont
ouvertes ; `services/access.service.js` décide **sur quels enfants** elles s'appliquent.
Un éducateur a le droit d'ouvrir une fiche enfant, mais pas n'importe laquelle.

Le tableau des rôles est en tête de ce document :
[Ce que fait l'application](#ce-que-fait-lapplication).

**Gestion des comptes** (`director` uniquement) : `GET|POST /api/users`,
`GET|PATCH /api/users/:id`, `POST /api/users/:id/password`, `DELETE /api/users/:id`
(désactivation, pas suppression : les comptes rendus gardent un auteur identifiable).

**Lien de suivi famille** — `POST /api/children/:id/share-link` rend un jeton signé,
valable 7 jours, qui ouvre `GET /api/share/:token/progress` et `/goals` sans mot de passe.
Sa portée s'arrête là : présenté sur une autre route, il est refusé.

</details>

<details>
<summary><b>Enfants</b></summary>

<br>

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/children` | Liste. Filtres : `search`, `group`, `disabilityType`, `status` (`all` inclut les archives), `page`, `pageSize` |
| `POST` | `/api/children` | Crée une fiche (409 si l'enfant existe déjà) — `educator` (dans ses groupes), `director` |
| `GET` | `/api/children/:id` | Fiche individuelle complète (+ `age`, `displayName`) |
| `PATCH` | `/api/children/:id` | Mise à jour partielle — `nurse`, `director` |
| `DELETE` | `/api/children/:id` | Archive la fiche ; `?purge=true` efface définitivement — `director` |

La fiche porte : identité (`firstName`, `lastName`, `birthDate`, `gender`, `address`), `group`,
`disability` (`type`, `details`, `recognizedAt`, `supportPlan`), `familyContacts[]`
(`relationship`, `phone`, `email`, `isPrimary`…), `referringDoctor` et `notes`.

Un éducateur crée une fiche **dans ses groupes uniquement** (403 ailleurs) : autrement il
inscrirait un enfant dans un groupe qu'il n'a pas le droit de consulter, et la fiche
disparaîtrait de sa vue à la seconde où elle est écrite. Le `referringDoctor` qu'il
enverrait est ignoré — c'est une donnée médicale, qu'il ne pourrait pas relire.

</details>

<details>
<summary><b>Présences et alertes d'absences</b></summary>

<br>

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/attendance?date=&group=` | Feuille du jour ; les enfants sans saisie ont `record: null` |
| `POST` | `/api/attendance` | Saisie d'un enfant (crée ou corrige) |
| `POST` | `/api/attendance/bulk` | Feuille d'appel d'un groupe en une requête |
| `GET` | `/api/attendance/alerts?group=&severity=` | Tableau de bord des absences répétées |
| `GET` | `/api/children/:id/attendance?from=&to=` | Historique, compteurs et alertes d'un enfant |
| `GET` | `/api/children/:id/attendance/alerts` | Alertes d'un enfant seul |
| `DELETE` | `/api/attendance/:childId/:date` | Annule une saisie erronée |

Statuts : `present`, `late` (heure d'arrivée obligatoire), `absent` (non justifiée),
`excused` (motif obligatoire).

**Alertes automatiques** — elles ne sont jamais stockées : `utils/attendanceAlerts.js` les
recalcule à chaque lecture, si bien qu'une saisie corrigée fait disparaître son alerte.
Deux règles, réglables dans `.env` :

- `consecutive-absences` : N jours d'accueil consécutifs manqués (défaut 3), justifiés ou non
- `repeated-absences` : M absences **non justifiées** sur une fenêtre glissante (défaut 4 / 30 jours)

Une alerte passe de `warning` à `critical` au double du seuil. La réponse d'une saisie
renvoie dans `meta.alerts` les alertes actives pour l'enfant concerné.

</details>

<details>
<summary><b>Activités et galerie anonymisée</b></summary>

<br>

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/activities` | Liste interne (participants nommés) |
| `POST` | `/api/activities` | Crée une activité et ses participants |
| `GET` | `/api/activities/:id` | Détail |
| `PATCH` | `/api/activities/:id` | Mise à jour partielle |
| `DELETE` | `/api/activities/:id` | Suppression |
| `GET` | `/api/children/:id/gallery` | **Galerie anonymisée** de l'enfant |

Dans la galerie, seul l'enfant dont on ouvre la fiche est nommé. Les autres participants
deviennent `Enfant #A3F1`, y compris dans le titre, la description et les légendes de photos.
L'alias est dérivé de `sha256(sel + activité + enfant)` : il est stable dans une activité mais
change d'une activité à l'autre, ce qui empêche de recouper deux galeries pour ré-identifier
quelqu'un. Les identifiants d'enfants et l'auteur de la saisie ne sortent pas.

</details>

<details>
<summary><b>Suivi pédagogique : objectifs, séances, comptes rendus, courbes</b></summary>

<br>

**Objectifs personnalisés**

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/children/:id/goals` | Objectifs de l'enfant + avancement moyen |
| `POST` | `/api/children/:id/goals` | Crée un objectif — `educator`, `director` |
| `GET` | `/api/goals` | Tous les objectifs du périmètre |
| `GET` | `/api/goals/:goalId` | Détail |
| `PATCH` | `/api/goals/:goalId` | Mise à jour (dont `progress` 0-100) |
| `DELETE` | `/api/goals/:goalId` | Suppression — `director` |

`status` et `progress` restent cohérents automatiquement : passer à 100 % marque l'objectif
`achieved` et date son atteinte ; le rouvrir efface cette date.

**Séances et comptes rendus**

| Méthode | URL | Effet |
| --- | --- | --- |
| `POST` | `/api/children/:id/sessions` | Planifie ou enregistre une séance |
| `GET` | `/api/children/:id/sessions` | **Historique complet**, comptes rendus inclus |
| `GET` | `/api/sessions` | Liste du périmètre (filtres `status`, `from`, `to`, `educatorId`) |
| `GET` | `/api/sessions/:id` | Détail + objectifs + compte rendu |
| `PATCH` | `/api/sessions/:id` | Modification |
| `POST` | `/api/sessions/:id/cancel` | Annulation motivée |
| `POST` | `/api/sessions/:id/report` | **Formulaire de compte rendu** (un par séance) |
| `GET` | `/api/reports` | Liste des comptes rendus |
| `GET` | `/api/reports/pending` | Comptes rendus en attente, avec les retards |
| `PATCH` | `/api/reports/:id` | Correction |

Le compte rendu porte `mood` (5 niveaux), `observations`, `attentionPoints[]`,
`goalProgress[]` (`{ goalId, progress, comment }`), `nextSteps` et `healthFlag`.

Déposer un compte rendu a deux effets voulus : la séance passe en `completed`, et le taux
d'avancement de chaque objectif évalué est mis à jour. C'est ce qui alimente les courbes
**sans double saisie**. Un `healthFlag` lève une alerte de santé pour l'infirmière.

**Courbes d'évolution sur 6 mois**

`GET /api/children/:id/progress?months=6` et `GET /api/goals/:goalId/progress` rendent,
par objectif : les `points` datés, une agrégation `monthly` (moyenne par mois, `null` quand
il n'y a pas eu de séance) et une `trend` (`start`, `current`, `delta`). Même structure pour
l'humeur, via un score de 1 à 5. L'interface trace directement, sans recalcul.

</details>

<details>
<summary><b>Tableau de bord et notifications</b></summary>

<br>

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/dashboard` | **Vue direction** — `director` |
| `GET` | `/api/notifications` | Fil personnel (`type`, `severity`, `unreadOnly`) |
| `POST` | `/api/notifications/:id/read` | Acquittement |
| `POST` | `/api/notifications/read` | Tout marquer comme lu |
| `GET` | `/api/notifications/subscriptions` | Abonnements push du compte |
| `POST` | `/api/notifications/subscriptions` | Enregistre un terminal |
| `DELETE` | `/api/notifications/subscriptions/:id` | Retire un terminal |

Le tableau de bord agrège présences (taux sur 30 j, feuille du jour, alertes), progression
moyenne globale et par groupe, séances, et rapports en attente. Il appelle les mêmes services
que les écrans de détail : il ne peut donc pas diverger de ce que voient les éducateurs.

Cinq types de notifications, adressées selon le rôle :

| Type | Déclencheur | Destinataires |
| --- | --- | --- |
| `absence-alert` | seuils d'absences répétées | directeur, éducateur |
| `medication-reminder` | prise prévue aujourd'hui, pas encore tracée | infirmière, directeur |
| `session-reminder` | séance planifiée dans les 2 jours | éducateur, directeur |
| `report-pending` | séance passée sans compte rendu | éducateur, directeur |
| `health-alert` | `healthFlag` levé dans un compte rendu | infirmière, directeur |

Comme les alertes d'absence, elles sont **calculées à la lecture**, jamais stockées : un
médicament administré ou un compte rendu déposé fait disparaître la notification, sans tâche
de nettoyage. Seul l'acquittement est persisté. L'envoi vers les terminaux (Web Push / FCM)
n'est pas branché — les abonnements sont collectés, le dispatch reste à écrire.

</details>

<details>
<summary><b>Traitements et rappels de médicaments</b></summary>

<br>

Réservé à `nurse` et `director`.

| Méthode | URL | Effet |
| --- | --- | --- |
| `GET` | `/api/children/:id/medications` | Traitements de l'enfant |
| `POST` | `/api/children/:id/medications` | Nouveau traitement |
| `PATCH` | `/api/medications/:id` | Modification |
| `DELETE` | `/api/medications/:id` | Désactivation (l'historique est conservé) |
| `GET` | `/api/medications/doses?date=` | Prises attendues du jour, avec leur statut |
| `POST` | `/api/medications/:id/administrations` | Trace une prise (`given`/`refused`/`missed`) |
| `GET` | `/api/children/:id/administrations` | Historique des prises |

`schedule` vaut `{ times: ["08:00","12:00"], days: [1,2,3,4,5] }` — `days` vide signifie
tous les jours (1 = lundi).

</details>

<details>
<summary><b>Export PDF et référentiel</b></summary>

<br>

**Export PDF** — `GET /api/children/:id/progress.pdf?months=6` rend le rapport de
progression destiné aux familles et partenaires : identité, synthèse de la période, taux de
présence, puis un bloc par objectif avec barre d'avancement, tendance chiffrée, courbe
mensuelle et dernière observation. Généré avec pdfkit et écrit directement dans la réponse —
rien n'atterrit sur le disque. Le document ne contient ni note interne, ni nom d'autre
enfant, ni détail médical.

**Référentiel** — `GET /api/reference` renvoie les listes de valeurs (types de handicap,
statuts, catégories, humeurs, domaines d'objectifs…) sous forme `{ value, label }`, les
groupes existants et les seuils d'alerte. L'interface n'a donc aucune liste en dur.

</details>

---

## Stockage

Deux pilotes, choisis par la configuration :

| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Pilote | Données |
| --- | --- | --- |
| renseignés | Supabase (PostgreSQL) | persistées |
| absents | mémoire | perdues au redémarrage |

Le pilote mémoire ne sort pas du développement : avec `NODE_ENV=production` et des clés
Supabase absentes, le serveur **refuse de démarrer**. Il répondrait sinon normalement
pendant que les équipes saisissent des présences et des comptes rendus, pour tout perdre
au premier redémarrage — sans message d'erreur.

```
src/models/
├── child.model.js      # aiguillage : choisit le pilote, c'est ce qu'importent les services
├── driver.js           # décide du pilote selon l'environnement
├── memory/             # implémentation en mémoire (tests, démarrage sans base)
└── supabase/           # implémentation PostgreSQL via @supabase/supabase-js
```

Les services importent toujours `../models/child.model.js` et ignorent d'où viennent les
données. C'est ce qui permet aux 176 tests de tourner sans base ni réseau, sur exactement le
même code métier.

### Brancher Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → *New query* → coller [`backend/supabase/schema.sql`](backend/supabase/schema.sql) → *Run*.
3. Dans `backend/.env`, renseigner `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
   (*Project Settings → Data API*).
4. `npm run seed --workspace backend` — crée les comptes et le jeu de démonstration.
   La commande est idempotente : la relancer ne duplique rien.

> [!WARNING]
> Pour une base **de production**, sauter l'étape 4 : le seed y créerait des comptes de
> démonstration. Utiliser `npm run create-admin --workspace backend` à la place, qui crée
> un unique compte de direction avec vos identifiants.

Au démarrage, le serveur annonce le pilote retenu : `stockage : supabase` ou `stockage : memory`.

La clé `service_role` donne les pleins pouvoirs sur la base : elle reste côté serveur et ne
doit **jamais** être exposée au navigateur. Les policies RLS du schéma rejouent le périmètre
de chaque rôle — l'API se connectant en `service_role` les contourne, elles servent de
seconde barrière si l'interface parlait un jour directement à Supabase.

### Jeu de démonstration

Six comptes (un par rôle, deux éducateurs), cinq enfants, sept semaines de présences, quatre
activités, six mois d'objectifs et de comptes rendus, deux traitements — de quoi voir les
alertes, les courbes et les rappels dès le premier démarrage. En mémoire il est rechargé à
chaque démarrage ; avec Supabase il est écrit une fois par `npm run seed`.

| Compte de démonstration | Rôle |
| --- | --- |
| `admin@papillonbleu.test` | administrateur |
| `directrice@papillonbleu.test` | directrice |
| `infirmiere@papillonbleu.test` | infirmière |
| `educateur.coquelicots@papillonbleu.test` | éducateur (Les Coquelicots) |
| `educateur.bleuets@papillonbleu.test` | éducateur (Les Bleuets) |
| `famille.bakayoko@papillonbleu.test` | famille (Lina) |

**Aucun mot de passe n'est écrit dans le dépôt.** Les six comptes partagent celui de
`SEED_PASSWORD` (`backend/.env`, hors dépôt). Laissé vide, l'amorçage en tire un au hasard
et l'affiche **une seule fois** dans la console — seul son hachage est conservé, donc le
relire ensuite est impossible. En stockage mémoire, le jeu étant rechargé à chaque
démarrage, un `SEED_PASSWORD` fixe évite d'aller rechercher la valeur dans les journaux.

Détail complet du jeu de données : [COMPTES-DE-TEST.md](COMPTES-DE-TEST.md).

---

## Tests

```bash
npm test --workspace backend
```

176 tests avec `node --test`, sans dépendance supplémentaire.

| Portée | Ce qui est couvert |
| --- | --- |
| Unitaire | règles d'alerte d'absence, anonymisation de la galerie, agrégations, TOTP (vecteurs RFC 6238) |
| Bout en bout | authentification, RBAC, périmètre par rôle, suivi pédagogique, notifications, export PDF, réinitialisation de mot de passe |

Les tests bout en bout démarrent un serveur éphémère sur le pilote mémoire : ni base ni
réseau à provisionner, et exactement le même code métier qu'en production.

---

## Essayer l'API à la main

Un jeu de requêtes prêt à l'emploi couvrant les endpoints — y compris les 401 et 403
attendus, qui sont la meilleure démonstration du contrôle d'accès.

**VS Code** — ouvrir [`backend/requests.http`](backend/requests.http) avec l'extension
REST Client (`humao.rest-client`) et cliquer sur « Send Request ». Les requêtes se
chaînent : lancer « Connexion » en premier, les suivantes réutilisent le jeton.

Cela suppose l'API démarrée (`npm run dev`) et utilise les comptes de démonstration
ci-dessus.

Pour la réinitialisation de mot de passe, le jeton n'arrive pas dans la réponse mais par
courriel : en développement, le lien est écrit dans les logs de `npm run dev`, il suffit
de l'y copier.

---

## Ajouter une ressource

Exemple avec `patients`, dans l'ordre :

1. `backend/src/models/patient.model.js` — accès aux données
2. `backend/src/services/patient.service.js` — logique métier
3. `backend/src/controllers/patient.controller.js` — req/res
4. `backend/src/routes/patient.routes.js` — puis monter la route dans `routes/index.js`
5. `frontend/src/api/patient.api.js` — appels via `apiClient`
6. `frontend/src/pages/PatientsPage.jsx` — la vue
7. `frontend/src/lib/routes.js` — déclarer l'écran pour qu'il soit chargé à la demande

---

## Mise en ligne

Supabase pour la base, un hébergeur Node pour l'API, Netlify pour l'interface :
la procédure complète est dans **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

> [!IMPORTANT]
> Netlify ne peut pas héberger l'API : c'est un serveur Express qui tourne en continu,
> garde des sessions et diffuse des PDF. Le relais `/api/*` déclaré dans `netlify.toml`
> est obligatoire — sans lui, le cookie de session `SameSite=Strict` ne partirait jamais
> et la connexion échouerait silencieusement.

---

<div align="center">

Développé par **Amadou Diop**

</div>
