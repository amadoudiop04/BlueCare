# BlueCare

Monorepo npm workspaces : un frontend React (Vite + Tailwind) et une API Node/Express.

## Prerequis

- Node.js >= 20.19
- npm >= 10

## Demarrage

```bash
npm install                       # installe frontend + backend en une fois
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev                       # lance l'API et le front en parallele
```

- Frontend : http://localhost:5173
- API : http://localhost:3000/api/health

En dev, le front appelle `/api/...` et Vite relaie vers Express (voir `frontend/vite.config.js`).
Les URLs sont donc les memes en dev et en production.

## Scripts (a la racine)

| Commande               | Effet                                        |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Lance backend + frontend en parallele          |
| `npm run dev:frontend` | Lance uniquement Vite                          |
| `npm run dev:backend`  | Lance uniquement l'API (avec `--watch`)        |
| `npm run build`        | Build de production du frontend (`frontend/dist`) |
| `npm start`            | Demarre l'API en mode production               |
| `npm run lint`         | ESLint sur les deux workspaces                 |

Pour cibler un workspace : `npm run <script> --workspace frontend`.

## Structure

```
BlueCare/
├── package.json            # workspaces + scripts d'orchestration
├── frontend/
│   ├── index.html
│   ├── vite.config.js      # alias @ -> src, proxy /api -> backend
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/             # fichiers servis tels quels (favicon...)
│   └── src/
│       ├── main.jsx        # point d'entree React
│       ├── App.jsx         # composant racine
│       ├── api/            # client HTTP + un fichier par domaine
│       ├── assets/         # images/polices importees depuis le code
│       ├── components/
│       │   ├── layout/     # structure de page (header, sidebar...)
│       │   └── ui/         # composants generiques reutilisables
│       ├── features/       # modules metier autonomes
│       ├── hooks/          # hooks React partages
│       ├── lib/            # helpers purs, sans React
│       ├── pages/          # une page = une vue
│       └── styles/         # CSS global et directives Tailwind
└── backend/
    ├── .env.example
    ├── supabase/
    │   └── schema.sql      # tables, contraintes, index et policies RLS
    ├── tests/              # tests `node --test` (unitaires + bout en bout)
    └── src/
        ├── server.js       # demarrage HTTP uniquement
        ├── app.js          # construction de l'app Express (testable seule)
        ├── config/         # lecture et validation de l'environnement
        ├── constants/      # vocabulaire metier + roles
        ├── routes/         # declaration des URLs et garde-fous par role
        ├── controllers/    # req/res -> service -> reponse
        ├── services/       # logique metier (ne connait pas Express)
        ├── models/         # acces aux donnees
        ├── middlewares/    # authenticate, authorize, erreurs
        └── utils/          # logger, ApiError, jwt, password, validation, alertes
```

## Conventions

**Backend** — une requete traverse toujours `route -> controller -> service -> model`.
Un controller ne contient pas de logique metier, un service ne touche pas a `req`/`res`.
Les controllers async sont enveloppes dans `asyncHandler` pour que leurs erreurs
remontent a `errorHandler`, qui est le seul a formater les reponses d'erreur.

**Frontend** — l'alias `@` pointe vers `src/`, donc on importe
`@/components/ui/Button.jsx` plutot que `../../../components/ui/Button.jsx`.
Tout appel reseau passe par `src/api/client.js`.

**Environnement** — aucune variable en dur dans le code : cote backend on lit
`src/config/env.js`, cote frontend les variables prefixees `VITE_`. Les `.env`
ne sont pas versionnes, seuls les `.env.example` le sont. En production, `JWT_SECRET`
et `JWT_REFRESH_SECRET` sont obligatoires : sans eux le serveur refuse de demarrer,
plutot que de tourner avec une cle connue de tous.

**Securite** — une route protegee declare toujours `authenticate` puis `authorize(...)`.
Le service, lui, verifie le perimetre via `requireChildAccess` : ne jamais se fier au seul
role pour decider qu'un enfant est accessible.

## API

Toutes les reponses suivent la meme forme : `{ "status": "ok", "data": ..., "meta": ... }`.
En cas d'erreur : `{ "status": "error", "message": "...", "details": { "champ": ["..."] } }`.

### Authentification

Hors `/api/health`, `/api/auth/login|refresh` et `/api/share/:token/...`, toute requete
exige un en-tete `Authorization: Bearer <accessToken>`.

| Methode | URL                             | Effet                                                    |
| ------- | ------------------------------- | -------------------------------------------------------- |
| `POST`  | `/api/auth/login`               | `{ email, password }` -> profil + access et refresh token |
| `POST`  | `/api/auth/refresh`             | `{ refreshToken }` -> nouvel access token                 |
| `GET`   | `/api/auth/me`                  | Profil courant et perimetre (groupes, nombre d'enfants)   |
| `POST`  | `/api/auth/password`            | Change son mot de passe (ancien exige)                    |

Le mot de passe est hache avec bcrypt. L'access token vaut 24 h, le refresh token 30 j
(`JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`). Les deux sont signes avec des secrets **distincts** :
un refresh token presente comme access token est rejete.

Le jeton ne porte que l'identifiant et le role. Le perimetre est relu en base a chaque
requete, donc desactiver un compte ou changer une affectation prend effet immediatement,
sans attendre l'expiration du jeton.

### Roles et perimetre

Deux controles se cumulent. `middlewares/authorize.js` decide **quelles routes** sont
ouvertes ; `services/access.service.js` decide **sur quels enfants** elles s'appliquent.
Un educateur a le droit d'ouvrir une fiche enfant, mais pas n'importe laquelle.

| Role         | Perimetre                   | Peut                                                                  |
| ------------ | --------------------------- | --------------------------------------------------------------------- |
| `educator`   | les enfants de ses groupes  | presences, activites, objectifs, seances, comptes-rendus              |
| `nurse`      | tout le centre              | donnees medicales, traitements, rappels, alertes de sante             |
| `director`   | tout le centre              | tout, plus le tableau de bord, les exports et la gestion des comptes  |
| `family`     | ses propres enfants         | **lecture seule** : progression, objectifs, galerie, export PDF       |

Le medecin referent n'est visible que par l'infirmiere et la direction. Les seances et
comptes-rendus restent internes : une famille recoit la progression, pas les observations
brutes de l'equipe.

**Gestion des comptes** (`director` uniquement) : `GET|POST /api/users`,
`GET|PATCH /api/users/:id`, `POST /api/users/:id/password`, `DELETE /api/users/:id`
(desactivation, pas suppression : les comptes-rendus gardent un auteur identifiable).

**Lien de suivi famille** — `POST /api/children/:id/share-link` rend un jeton signe,
valable 7 jours, qui ouvre `GET /api/share/:token/progress` et `/goals` sans mot de passe.
Sa portee s'arrete la : presente sur une autre route, il est refuse.

### Enfants

| Methode  | URL                              | Effet                                                     |
| -------- | -------------------------------- | --------------------------------------------------------- |
| `GET`    | `/api/children`                  | Liste. Filtres : `search`, `group`, `disabilityType`, `status` (`all` inclut les archives), `page`, `pageSize` |
| `POST`   | `/api/children`                  | Cree une fiche (409 si l'enfant existe deja) — `director`  |
| `GET`    | `/api/children/:id`              | Fiche individuelle complete (+ `age`, `displayName`)      |
| `PATCH`  | `/api/children/:id`              | Mise a jour partielle — `nurse`, `director`               |
| `DELETE` | `/api/children/:id`              | Archive la fiche ; `?purge=true` efface definitivement — `director` |

La fiche porte : identite (`firstName`, `lastName`, `birthDate`, `gender`, `address`), `group`,
`disability` (`type`, `details`, `recognizedAt`, `supportPlan`), `familyContacts[]`
(`relationship`, `phone`, `email`, `isPrimary`...), `referringDoctor` et `notes`.

### Presences

| Methode  | URL                                        | Effet                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------ |
| `GET`    | `/api/attendance?date=&group=`             | Feuille du jour ; les enfants sans saisie ont `record: null` |
| `POST`   | `/api/attendance`                          | Saisie d'un enfant (cree ou corrige)                   |
| `POST`   | `/api/attendance/bulk`                     | Feuille d'appel d'un groupe en une requete             |
| `GET`    | `/api/attendance/alerts?group=&severity=`  | Tableau de bord des absences repetees                  |
| `GET`    | `/api/children/:id/attendance?from=&to=`   | Historique, compteurs et alertes d'un enfant           |
| `GET`    | `/api/children/:id/attendance/alerts`      | Alertes d'un enfant seul                               |
| `DELETE` | `/api/attendance/:childId/:date`           | Annule une saisie erronee                              |

Statuts : `present`, `late` (heure d'arrivee obligatoire), `absent` (non justifiee),
`excused` (motif obligatoire).

**Alertes automatiques** — elles ne sont jamais stockees : `utils/attendanceAlerts.js` les
recalcule a chaque lecture, si bien qu'une saisie corrigee fait disparaitre son alerte.
Deux regles, reglables dans `.env` :

- `consecutive-absences` : N jours d'accueil consecutifs manques (defaut 3), justifies ou non
- `repeated-absences` : M absences **non justifiees** sur une fenetre glissante (defaut 4 / 30 jours)

Une alerte passe de `warning` a `critical` au double du seuil. La reponse d'une saisie
renvoie dans `meta.alerts` les alertes actives pour l'enfant concerne.

### Activites et galerie

| Methode  | URL                          | Effet                                          |
| -------- | ---------------------------- | ---------------------------------------------- |
| `GET`    | `/api/activities`            | Liste interne (participants nommes)            |
| `POST`   | `/api/activities`            | Cree une activite et ses participants          |
| `GET`    | `/api/activities/:id`        | Detail                                         |
| `PATCH`  | `/api/activities/:id`        | Mise a jour partielle                          |
| `DELETE` | `/api/activities/:id`        | Suppression                                    |
| `GET`    | `/api/children/:id/gallery`  | **Galerie anonymisee** de l'enfant             |

Dans la galerie, seul l'enfant dont on ouvre la fiche est nomme. Les autres participants
deviennent `Enfant #A3F1`, y compris dans le titre, la description et les legendes de photos.
L'alias est derive de `sha256(sel + activite + enfant)` : il est stable dans une activite mais
change d'une activite a l'autre, ce qui empeche de recouper deux galeries pour re-identifier
quelqu'un. Les identifiants d'enfants et l'auteur de la saisie ne sortent pas.

### Suivi pedagogique

**Objectifs personnalises**

| Methode  | URL                                     | Effet                                              |
| -------- | --------------------------------------- | -------------------------------------------------- |
| `GET`    | `/api/children/:id/goals`               | Objectifs de l'enfant + avancement moyen           |
| `POST`   | `/api/children/:id/goals`               | Cree un objectif — `educator`, `director`          |
| `GET`    | `/api/goals`                            | Tous les objectifs du perimetre                    |
| `GET`    | `/api/goals/:goalId`                    | Detail                                             |
| `PATCH`  | `/api/goals/:goalId`                    | Mise a jour (dont `progress` 0-100)                |
| `DELETE` | `/api/goals/:goalId`                    | Suppression — `director`                           |

`status` et `progress` restent coherents automatiquement : passer a 100 % marque l'objectif
`achieved` et date son atteinte ; le rouvrir efface cette date.

**Seances et comptes-rendus**

| Methode  | URL                                        | Effet                                            |
| -------- | ------------------------------------------ | ------------------------------------------------ |
| `POST`   | `/api/children/:id/sessions`               | Planifie ou enregistre une seance                |
| `GET`    | `/api/children/:id/sessions`               | **Historique complet**, comptes-rendus inclus    |
| `GET`    | `/api/sessions`                            | Liste du perimetre (filtres `status`, `from`, `to`, `educatorId`) |
| `GET`    | `/api/sessions/:id`                        | Detail + objectifs + compte-rendu                |
| `PATCH`  | `/api/sessions/:id`                        | Modification                                     |
| `POST`   | `/api/sessions/:id/cancel`                 | Annulation motivee                               |
| `POST`   | `/api/sessions/:id/report`                 | **Formulaire de compte-rendu** (un par seance)   |
| `GET`    | `/api/reports`                             | Liste des comptes-rendus                         |
| `GET`    | `/api/reports/pending`                     | Comptes-rendus en attente, avec les retards      |
| `PATCH`  | `/api/reports/:id`                         | Correction                                       |

Le compte-rendu porte `mood` (5 niveaux), `observations`, `attentionPoints[]`,
`goalProgress[]` (`{ goalId, progress, comment }`), `nextSteps` et `healthFlag`.

Deposer un compte-rendu a deux effets voulus : la seance passe en `completed`, et le taux
d'avancement de chaque objectif evalue est mis a jour. C'est ce qui alimente les courbes
**sans double saisie**. Un `healthFlag` leve une alerte de sante pour l'infirmiere.

**Courbes d'evolution sur 6 mois**

`GET /api/children/:id/progress?months=6` et `GET /api/goals/:goalId/progress` rendent,
par objectif : les `points` dates, une agregation `monthly` (moyenne par mois, `null` quand
il n'y a pas eu de seance) et une `trend` (`start`, `current`, `delta`). Meme structure pour
l'humeur, via un score de 1 a 5. Le front trace directement, sans recalcul.

### Tableau de bord et notifications

| Methode  | URL                                       | Effet                                             |
| -------- | ----------------------------------------- | ------------------------------------------------- |
| `GET`    | `/api/dashboard`                          | **Vue direction** — `director`                    |
| `GET`    | `/api/notifications`                      | Fil personnel (`type`, `severity`, `unreadOnly`)  |
| `POST`   | `/api/notifications/:id/read`             | Acquittement                                      |
| `POST`   | `/api/notifications/read`                 | Tout marquer comme lu                             |
| `GET`    | `/api/notifications/subscriptions`        | Abonnements push du compte                        |
| `POST`   | `/api/notifications/subscriptions`        | Enregistre un terminal                            |
| `DELETE` | `/api/notifications/subscriptions/:id`    | Retire un terminal                                |

Le tableau de bord agrege presences (taux sur 30 j, feuille du jour, alertes), progression
moyenne globale et par groupe, seances, et rapports en attente. Il appelle les memes services
que les ecrans de detail : il ne peut donc pas diverger de ce que voient les educateurs.

Cinq types de notifications, adressees selon le role :

| Type                   | Declencheur                                    | Destinataires          |
| ---------------------- | ---------------------------------------------- | ---------------------- |
| `absence-alert`        | seuils d'absences repetees                     | directeur, educateur   |
| `medication-reminder`  | prise prevue aujourd'hui, pas encore tracee    | infirmiere, directeur  |
| `session-reminder`     | seance planifiee dans les 2 jours              | educateur, directeur   |
| `report-pending`       | seance passee sans compte-rendu                | educateur, directeur   |
| `health-alert`         | `healthFlag` leve dans un compte-rendu         | infirmiere, directeur  |

Comme les alertes d'absence, elles sont **calculees a la lecture**, jamais stockees : un
medicament administre ou un compte-rendu depose fait disparaitre la notification, sans tache
de nettoyage. Seul l'acquittement est persiste. L'envoi vers les terminaux (Web Push / FCM)
n'est pas branche — les abonnements sont collectes, le dispatch reste a ecrire.

### Traitements et rappels de medicaments

Reserve a `nurse` et `director`.

| Methode  | URL                                             | Effet                                     |
| -------- | ----------------------------------------------- | ----------------------------------------- |
| `GET`    | `/api/children/:id/medications`                 | Traitements de l'enfant                   |
| `POST`   | `/api/children/:id/medications`                 | Nouveau traitement                        |
| `PATCH`  | `/api/medications/:id`                          | Modification                              |
| `DELETE` | `/api/medications/:id`                          | Desactivation (l'historique est conserve) |
| `GET`    | `/api/medications/doses?date=`                  | Prises attendues du jour, avec leur statut |
| `POST`   | `/api/medications/:id/administrations`          | Trace une prise (`given`/`refused`/`missed`) |
| `GET`    | `/api/children/:id/administrations`             | Historique des prises                     |

`schedule` vaut `{ times: ["08:00","12:00"], days: [1,2,3,4,5] }` — `days` vide signifie
tous les jours (1 = lundi).

### Export PDF

`GET /api/children/:id/progress.pdf?months=6` rend le rapport de progression destine aux
familles et partenaires : identite, synthese de la periode, taux de presence, puis un bloc
par objectif avec barre d'avancement, tendance chiffree, courbe mensuelle et derniere
observation. Genere avec pdfkit et ecrit directement dans la reponse — rien n'atterrit sur
le disque. Le document ne contient ni note interne, ni nom d'autre enfant, ni detail medical.

### Referentiel

`GET /api/reference` renvoie les listes de valeurs (types de handicap, statuts, categories,
humeurs, domaines d'objectifs...) sous forme `{ value, label }`, les groupes existants et les
seuils d'alerte. Le front n'a donc aucune liste en dur.

## Stockage

Les donnees vivent aujourd'hui **en memoire** (`src/models/store.js`) et disparaissent au
redemarrage. Seuls les fichiers `*.model.js` y touchent.

Le schema PostgreSQL cible est ecrit : [`backend/supabase/schema.sql`](backend/supabase/schema.sql).
Il couvre les tables (utilisateurs, enfants, presences, activites, objectifs, seances,
comptes-rendus, traitements...), les contraintes qui portent les regles metier — une presence
par enfant et par jour, un compte-rendu par seance, un objectif atteint est a 100 % — les
index, et les policies **RLS** qui rejouent en base le perimetre de chaque role.

Basculer sur Supabase revient a executer ce SQL puis a reecrire les `*.model.js` avec
`@supabase/supabase-js`. Les services, controllers et routes ne bougent pas : ils n'appellent
que les modeles, et ces modeles sont deja `async`.

En developpement, `SEED_DEMO_DATA` charge cinq comptes (un par role), cinq enfants, sept
semaines de presences, quatre activites, six mois d'objectifs et de comptes-rendus, et deux
traitements — de quoi voir les alertes, les courbes et les rappels des le premier demarrage.

| Compte de demonstration                        | Mot de passe       | Role                        |
| ---------------------------------------------- | ------------------ | --------------------------- |
| `directrice@papillonbleu.test`                 | `Directrice2026!`  | directeur                   |
| `infirmiere@papillonbleu.test`                 | `Infirmiere2026!`  | infirmiere                  |
| `educateur.coquelicots@papillonbleu.test`      | `Educateur2026!`   | educateur (Les Coquelicots) |
| `educateur.bleuets@papillonbleu.test`          | `Educateur2026!`   | educateur (Les Bleuets)     |
| `famille.bakayoko@papillonbleu.test`           | `Famille2026!`     | famille (Lina)              |

## Tests

```bash
npm test --workspace backend
```

`node --test`, sans dependance supplementaire : les regles d'alerte, l'anonymisation et les
agregations sont testees unitairement ; l'authentification, le RBAC, le perimetre par role,
le suivi pedagogique, les notifications et l'export PDF le sont de bout en bout via un
serveur ephemere.

## Essayer l'API a la main

Deux jeux de requetes pretes a l'emploi, couvrant tous les endpoints — y compris les 401 et
403 attendus, qui sont la meilleure demonstration du controle d'acces.

**Postman** — importer [`backend/postman/BlueCare.postman_collection.json`](backend/postman/BlueCare.postman_collection.json)
(*Import* > *Files*). Lancer le dossier « 1. Authentification » en premier : les jetons des
quatre roles et les identifiants (enfant, objectif, seance, traitement) sont captures
automatiquement dans les variables de collection. La collection entiere se rejoue telle
quelle avec le Collection Runner.

```bash
# Sans ouvrir Postman, en ligne de commande :
npx newman run backend/postman/BlueCare.postman_collection.json
```

**VS Code** — ouvrir [`backend/requests.http`](backend/requests.http) avec l'extension
REST Client (`humao.rest-client`) et cliquer sur « Send Request ». Meme principe de chainage,
meme couverture.

Les deux supposent l'API demarree (`npm run dev`) et utilisent les comptes de demonstration
ci-dessus.

## Ajouter une ressource (exemple : `patients`)

1. `backend/src/models/patient.model.js` — acces aux donnees
2. `backend/src/services/patient.service.js` — logique metier
3. `backend/src/controllers/patient.controller.js` — req/res
4. `backend/src/routes/patient.routes.js` — puis monter la route dans `routes/index.js`
5. `frontend/src/api/patient.api.js` — appels via `apiClient`
6. `frontend/src/pages/PatientsPage.jsx` — la vue
