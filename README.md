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
npm run dev                       # lance l API et le front en parallele
```

- Frontend : http://localhost:5173
- API : http://localhost:3000/api/health

En dev, le front appelle `/api/...` et Vite relaie vers Express (voir `frontend/vite.config.js`).
Les URLs sont donc les memes en dev et en production.

Pour la mise en ligne (Supabase, API Node, interface sur Netlify), suivre
[**DEPLOIEMENT.md**](DEPLOIEMENT.md).

## Scripts (a la racine)

| Commande               | Effet                                        |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Lance backend + frontend en parallele          |
| `npm run dev:frontend` | Lance uniquement Vite                          |
| `npm run dev:backend`  | Lance uniquement l API (avec `--watch`)        |
| `npm run build`        | Build de production du frontend (`frontend/dist`) |
| `npm start`            | Demarre l API en mode production               |
| `npm run lint`         | ESLint sur les deux workspaces                 |

Cote backend : `npm run seed --workspace backend` (jeu de demonstration, jamais en
production) et `npm run create-admin --workspace backend` (premier compte de direction
d une base vierge — voir [DEPLOIEMENT.md](DEPLOIEMENT.md)).

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
│       ├── main.jsx        # point d entree React
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
remontent a `errorHandler`, qui est le seul a formater les reponses d erreur.

**Frontend** — l alias `@` pointe vers `src/`, donc on importe
`@/components/ui/Button.jsx` plutot que `../../../components/ui/Button.jsx`.
Tout appel reseau passe par `src/api/client.js`.

**Environnement** — aucune variable en dur dans le code : cote backend on lit
`src/config/env.js`, cote frontend les variables prefixees `VITE_`. Les `.env`
ne sont pas versionnes, seuls les `.env.example` le sont. En production, `JWT_SECRET` est
obligatoire : sans lui le serveur refuse de demarrer, plutot que de tourner avec une cle
connue de tous.

**Securite** — une route protegee declare toujours `authenticate` puis `authorize(...)`.
Le service, lui, verifie le perimetre via `requireChildAccess` : ne jamais se fier au seul
role pour decider qu un enfant est accessible.

## API

Toutes les reponses suivent la meme forme : `{ "status": "ok", "data": ..., "meta": ... }`.
En cas d erreur : `{ "status": "error", "message": "...", "details": { "champ": ["..."] } }`.

### Authentification

La session est **opaque et stockee en base**, portee par un cookie `httpOnly`,
`SameSite=Strict` (et `Secure` en production) que JavaScript ne peut ni lire ni ecrire :
une injection de script n a rien a voler, contrairement a un jeton range dans
`localStorage`. Seul le hachage SHA-256 du jeton est conserve — une copie de la base ne
permet pas de rejouer une session.

Les clients sans gestionnaire de cookies (tests, Postman, scripts) recuperent le meme
jeton dans `meta.sessionToken` et l envoient en `Authorization: Bearer <jeton>`.

| Methode  | URL                                 | Effet                                                     |
| -------- | ----------------------------------- | --------------------------------------------------------- |
| `POST`   | `/api/auth/login`                   | `{ email, password }` -> profil + session, ou defi 2FA    |
| `POST`   | `/api/auth/mfa/verify`              | `{ challengeToken, code }` -> ouvre la session            |
| `POST`   | `/api/auth/logout`                  | Ferme la session courante et efface le cookie             |
| `GET`    | `/api/auth/me`                      | Profil courant et perimetre (groupes, nombre d enfants)   |
| `PATCH`  | `/api/auth/me`                      | Ses informations : nom, prenom, e-mail, telephone         |
| `POST`   | `/api/auth/password`                | Change son mot de passe (ancien exige)                    |
| `GET`    | `/api/auth/sessions`                | Appareils connectes                                       |
| `DELETE` | `/api/auth/sessions/:id`            | Revoque une session a distance                            |

Routes ouvertes sans session : `/api/health`, `/api/auth/login`, `/api/auth/mfa/verify`,
`/api/auth/logout`, `/api/auth/password/*` et `/api/share/:token/...`.

Le mot de passe est hache avec bcrypt. La session a une expiration glissante et une
expiration absolue : elle se prolonge a l usage, mais pas indefiniment. Le perimetre est
relu en base a chaque requete, donc desactiver un compte ou changer une affectation prend
effet immediatement.

Il reste deux jetons JWT, tous deux sans etat et de portee etroite : le lien de suivi
famille et le defi de double authentification.

`PATCH /api/auth/me` ne touche ni au role ni au perimetre : personne ne se promeut
soi-meme, ces deux champs restent dans la gestion des comptes. Le mot de passe courant
est exige **des que l adresse e-mail change**, et elle seule : c est elle qui recoit les
liens de reinitialisation, donc la remplacer depuis une session volee suffirait a
s emparer du compte.

A cote du cookie de session — `httpOnly`, invisible pour JavaScript — le serveur pose un
temoin `bluecare_signed_in`, lisible celui-la, sans aucun secret et de meme duree. Il ne
sert qu a repondre a une question que l interface ne peut pas se poser autrement : y
a-t-il une session a restaurer ? Sans lui, chaque ouverture de l ecran de connexion
appelait `/auth/me` pour rien et laissait un `401` dans la console.

#### Mot de passe oublie

| Methode | URL                                  | Effet                                             |
| ------- | ------------------------------------ | ------------------------------------------------- |
| `POST`  | `/api/auth/password/forgot`          | `{ email }` -> envoie un lien. Toujours `200`     |
| `GET`   | `/api/auth/password/reset/:token`    | `{ valid, mfaRequired }` avant d afficher le form |
| `POST`  | `/api/auth/password/reset/:token`    | `{ password, code? }` -> nouveau mot de passe     |

La demande repond **toujours** `200`, que l adresse existe ou non, et le temps de reponse
est aligne : ce formulaire ne doit pas permettre de decouvrir qui travaille au centre.
Seul le hachage du jeton est stocke, le lien vaut une heure (`PASSWORD_RESET_TTL_MINUTES`),
ne sert qu une fois, et en redemander un invalide le precedent.

**Le second facteur reste exige quand il est actif** : sans cela, un acces a la boite mail
suffirait a prendre le compte, ce qui viderait la double authentification de son sens —
c est precisement ce scenario contre lequel elle protege. Un code de secours est accepte
a la place du code TOTP.

Une reinitialisation ferme **toutes** les sessions du compte, sur tous les appareils : si
le compte etait compromis, changer le mot de passe sans deconnecter l intrus ne servirait
a rien. Les demandes sont plafonnees a 5 par adresse et 60 par origine, par quart d heure.

> Aucun fournisseur de courriel n est branche — le centre n en a pas encore choisi. En
> developpement, le lien est ecrit dans les logs du serveur. En production, le transport
> par defaut **echoue franchement** plutot que de faire croire qu un message est parti :
> brancher un vrai service dans `backend/src/utils/mailer.js`, seul endroit qui envoie
> des courriels.

#### Double authentification

| Methode | URL                        | Effet                                                  |
| ------- | -------------------------- | ------------------------------------------------------ |
| `GET`   | `/api/auth/mfa`            | Etat du second facteur sur son compte                  |
| `POST`  | `/api/auth/mfa/setup`      | Cree le secret et rend l URI `otpauth://` a scanner    |
| `POST`  | `/api/auth/mfa/enable`     | Confirme avec un code, puis rend les codes de secours  |
| `POST`  | `/api/auth/mfa/disable`    | Desactive (mot de passe exige)                         |

TOTP (RFC 6238) implemente sans dependance et verifie contre les vecteurs de test de la
norme. L activation exige un code valide : un scan rate ne peut pas enfermer quelqu un
dehors. Les codes de secours sont haches avec bcrypt et montres une seule fois. Un pas
deja consomme ne peut pas etre rejoue, et le compte se verrouille apres 5 echecs.

### Roles et perimetre

Deux controles se cumulent. `middlewares/authorize.js` decide **quelles routes** sont
ouvertes ; `services/access.service.js` decide **sur quels enfants** elles s'appliquent.
Un educateur a le droit d'ouvrir une fiche enfant, mais pas n'importe laquelle.

| Role         | Perimetre                   | Peut                                                                  |
| ------------ | --------------------------- | --------------------------------------------------------------------- |
| `educator`   | les enfants de ses groupes  | inscrire un enfant dans ses groupes, presences, activites, objectifs, seances, comptes-rendus |
| `nurse`      | tout le centre              | donnees medicales, traitements, rappels, alertes de sante             |
| `director`   | tout le centre              | tout, plus le tableau de bord, les exports et la gestion des comptes  |
| `family`     | ses propres enfants         | **lecture seule** : progression, objectifs, galerie, export PDF       |

Le medecin referent n'est visible que par l infirmiere et la direction. Les seances et
comptes-rendus restent internes : une famille recoit la progression, pas les observations
brutes de l equipe.

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
| `POST`   | `/api/children`                  | Cree une fiche (409 si l enfant existe deja) — `educator` (dans ses groupes), `director` |
| `GET`    | `/api/children/:id`              | Fiche individuelle complete (+ `age`, `displayName`)      |
| `PATCH`  | `/api/children/:id`              | Mise a jour partielle — `nurse`, `director`               |
| `DELETE` | `/api/children/:id`              | Archive la fiche ; `?purge=true` efface definitivement — `director` |

La fiche porte : identite (`firstName`, `lastName`, `birthDate`, `gender`, `address`), `group`,
`disability` (`type`, `details`, `recognizedAt`, `supportPlan`), `familyContacts[]`
(`relationship`, `phone`, `email`, `isPrimary`...), `referringDoctor` et `notes`.

Un educateur cree une fiche **dans ses groupes uniquement** (403 ailleurs) : autrement il
inscrirait un enfant dans un groupe qu il n a pas le droit de consulter, et la fiche
disparaitrait de sa vue a la seconde ou elle est ecrite. Le `referringDoctor` qu il
enverrait est ignore — c est une donnee medicale, qu il ne pourrait pas relire.

### Presences

| Methode  | URL                                        | Effet                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------ |
| `GET`    | `/api/attendance?date=&group=`             | Feuille du jour ; les enfants sans saisie ont `record: null` |
| `POST`   | `/api/attendance`                          | Saisie d un enfant (cree ou corrige)                   |
| `POST`   | `/api/attendance/bulk`                     | Feuille d appel d un groupe en une requete             |
| `GET`    | `/api/attendance/alerts?group=&severity=`  | Tableau de bord des absences repetees                  |
| `GET`    | `/api/children/:id/attendance?from=&to=`   | Historique, compteurs et alertes d un enfant           |
| `GET`    | `/api/children/:id/attendance/alerts`      | Alertes d un enfant seul                               |
| `DELETE` | `/api/attendance/:childId/:date`           | Annule une saisie erronee                              |

Statuts : `present`, `late` (heure d'arrivee obligatoire), `absent` (non justifiee),
`excused` (motif obligatoire).

**Alertes automatiques** — elles ne sont jamais stockees : `utils/attendanceAlerts.js` les
recalcule a chaque lecture, si bien qu une saisie corrigee fait disparaitre son alerte.
Deux regles, reglables dans `.env` :

- `consecutive-absences` : N jours d accueil consecutifs manques (defaut 3), justifies ou non
- `repeated-absences` : M absences **non justifiees** sur une fenetre glissante (defaut 4 / 30 jours)

Une alerte passe de `warning` a `critical` au double du seuil. La reponse d une saisie
renvoie dans `meta.alerts` les alertes actives pour l enfant concerne.

### Activites et galerie

| Methode  | URL                          | Effet                                          |
| -------- | ---------------------------- | ---------------------------------------------- |
| `GET`    | `/api/activities`            | Liste interne (participants nommes)            |
| `POST`   | `/api/activities`            | Cree une activite et ses participants          |
| `GET`    | `/api/activities/:id`        | Detail                                         |
| `PATCH`  | `/api/activities/:id`        | Mise a jour partielle                          |
| `DELETE` | `/api/activities/:id`        | Suppression                                    |
| `GET`    | `/api/children/:id/gallery`  | **Galerie anonymisee** de l enfant             |

Dans la galerie, seul l enfant dont on ouvre la fiche est nomme. Les autres participants
deviennent `Enfant #A3F1`, y compris dans le titre, la description et les legendes de photos.
L alias est derive de `sha256(sel + activite + enfant)` : il est stable dans une activite mais
change d une activite a l'autre, ce qui empeche de recouper deux galeries pour re-identifier
quelqu'un. Les identifiants d enfants et l auteur de la saisie ne sortent pas.

### Suivi pedagogique

**Objectifs personnalises**

| Methode  | URL                                     | Effet                                              |
| -------- | --------------------------------------- | -------------------------------------------------- |
| `GET`    | `/api/children/:id/goals`               | Objectifs de l enfant + avancement moyen           |
| `POST`   | `/api/children/:id/goals`               | Cree un objectif — `educator`, `director`          |
| `GET`    | `/api/goals`                            | Tous les objectifs du perimetre                    |
| `GET`    | `/api/goals/:goalId`                    | Detail                                             |
| `PATCH`  | `/api/goals/:goalId`                    | Mise a jour (dont `progress` 0-100)                |
| `DELETE` | `/api/goals/:goalId`                    | Suppression — `director`                           |

`status` et `progress` restent coherents automatiquement : passer a 100 % marque l objectif
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
d avancement de chaque objectif evalue est mis a jour. C est ce qui alimente les courbes
**sans double saisie**. Un `healthFlag` leve une alerte de sante pour l infirmiere.

**Courbes d evolution sur 6 mois**

`GET /api/children/:id/progress?months=6` et `GET /api/goals/:goalId/progress` rendent,
par objectif : les `points` dates, une agregation `monthly` (moyenne par mois, `null` quand
il n y a pas eu de seance) et une `trend` (`start`, `current`, `delta`). Meme structure pour
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
| `absence-alert`        | seuils d absences repetees                     | directeur, educateur   |
| `medication-reminder`  | prise prevue aujourd hui, pas encore tracee    | infirmiere, directeur  |
| `session-reminder`     | seance planifiee dans les 2 jours              | educateur, directeur   |
| `report-pending`       | seance passee sans compte-rendu                | educateur, directeur   |
| `health-alert`         | `healthFlag` leve dans un compte-rendu         | infirmiere, directeur  |

Comme les alertes d absence, elles sont **calculees a la lecture**, jamais stockees : un
medicament administre ou un compte-rendu depose fait disparaitre la notification, sans tache
de nettoyage. Seul l'acquittement est persiste. L'envoi vers les terminaux (Web Push / FCM)
n est pas branche — les abonnements sont collectes, le dispatch reste a ecrire.

### Traitements et rappels de medicaments

Reserve a `nurse` et `director`.

| Methode  | URL                                             | Effet                                     |
| -------- | ----------------------------------------------- | ----------------------------------------- |
| `GET`    | `/api/children/:id/medications`                 | Traitements de l enfant                   |
| `POST`   | `/api/children/:id/medications`                 | Nouveau traitement                        |
| `PATCH`  | `/api/medications/:id`                          | Modification                              |
| `DELETE` | `/api/medications/:id`                          | Desactivation (l historique est conserve) |
| `GET`    | `/api/medications/doses?date=`                  | Prises attendues du jour, avec leur statut |
| `POST`   | `/api/medications/:id/administrations`          | Trace une prise (`given`/`refused`/`missed`) |
| `GET`    | `/api/children/:id/administrations`             | Historique des prises                     |

`schedule` vaut `{ times: ["08:00","12:00"], days: [1,2,3,4,5] }` — `days` vide signifie
tous les jours (1 = lundi).

### Export PDF

`GET /api/children/:id/progress.pdf?months=6` rend le rapport de progression destine aux
familles et partenaires : identite, synthese de la periode, taux de presence, puis un bloc
par objectif avec barre d avancement, tendance chiffree, courbe mensuelle et derniere
observation. Genere avec pdfkit et ecrit directement dans la reponse — rien n'atterrit sur
le disque. Le document ne contient ni note interne, ni nom d autre enfant, ni detail medical.

### Referentiel

`GET /api/reference` renvoie les listes de valeurs (types de handicap, statuts, categories,
humeurs, domaines d objectifs...) sous forme `{ value, label }`, les groupes existants et les
seuils d alerte. Le front n'a donc aucune liste en dur.

## Stockage

Deux pilotes, choisis par la configuration :

| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Pilote | Donnees |
| -------------------------------------------- | ------ | ------- |
| renseignes                                    | Supabase (Postgres) | persistees |
| absents                                       | memoire | perdues au redemarrage |

Le pilote memoire ne sort pas du developpement : avec `NODE_ENV=production` et des clefs
Supabase absentes, le serveur **refuse de demarrer**. Il repondrait sinon normalement
pendant que les equipes saisissent des presences et des comptes-rendus, pour tout perdre
au premier redemarrage — sans message d erreur.

```
src/models/
├── child.model.js      # aiguillage : choisit le pilote, c est ce qu'importent les services
├── driver.js           # decide du pilote selon l'environnement
├── memory/             # implementation en memoire (tests, demarrage sans base)
└── supabase/           # implementation Postgres via @supabase/supabase-js
```

Les services importent toujours `../models/child.model.js` et ignorent d ou viennent les
donnees. C est ce qui permet aux 166 tests de tourner sans base ni reseau, sur exactement le
meme code metier.

### Brancher Supabase

1. Creer un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** > *New query* > coller [`backend/supabase/schema.sql`](backend/supabase/schema.sql) > *Run*.
3. Dans `backend/.env`, renseigner `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
   (*Project Settings > Data API*).
4. `npm run seed --workspace backend` — cree les comptes et le jeu de demonstration.
   La commande est idempotente : la relancer ne duplique rien.

> Pour une base **de production**, sauter l'etape 4 : le seed y creerait des comptes dont
> les mots de passe sont publies ci-dessous. Utiliser `npm run create-admin --workspace
> backend` a la place, qui cree un unique compte de direction avec vos identifiants.

Au demarrage, le serveur annonce le pilote retenu : `stockage : supabase` ou `stockage : memory`.

Le schema porte les regles metier en contraintes, pas seulement dans le code : une presence
par enfant et par jour, un compte-rendu par seance, un objectif atteint est a 100 %, une
absence justifiee a un motif. Il inclut aussi les policies **RLS** qui rejouent le perimetre
de chaque role — l API se connectant en `service_role` les contourne, elles servent de
seconde barriere si le front parlait un jour directement a Supabase.

La cle `service_role` donne les pleins pouvoirs sur la base : elle reste cote serveur et ne
doit jamais etre exposee au navigateur.

### Jeu de demonstration

Six comptes (un par role, deux educateurs), cinq enfants, sept semaines de presences, quatre activites, six
mois d objectifs et de comptes-rendus, deux traitements — de quoi voir les alertes, les
courbes et les rappels des le premier demarrage. En memoire il est recharge a chaque
demarrage ; avec Supabase il est ecrit une fois par `npm run seed`.

| Compte de demonstration                        | Role                        |
| ---------------------------------------------- | --------------------------- |
| `admin@papillonbleu.test`                      | administrateur              |
| `directrice@papillonbleu.test`                 | directeur                   |
| `infirmiere@papillonbleu.test`                 | infirmiere                  |
| `educateur.coquelicots@papillonbleu.test`      | educateur (Les Coquelicots) |
| `educateur.bleuets@papillonbleu.test`          | educateur (Les Bleuets)     |
| `famille.bakayoko@papillonbleu.test`           | famille (Lina)              |

**Aucun mot de passe n est ecrit dans le depot.** Les six comptes partagent celui de
`SEED_PASSWORD` (`backend/.env`, hors depot). Laisse vide, l amorcage en tire un au hasard
et l affiche **une seule fois** dans la console — seul son hachage est conserve, donc le
relire ensuite est impossible. En stockage memoire, le jeu etant recharge a chaque
demarrage, un `SEED_PASSWORD` fixe evite d aller rechercher la valeur dans les journaux.

## Tests

```bash
npm test --workspace backend
```

`node --test`, sans dependance supplementaire : les regles d alerte, l'anonymisation et les
agregations sont testees unitairement ; l'authentification, le RBAC, le perimetre par role,
le suivi pedagogique, les notifications et l'export PDF le sont de bout en bout via un
serveur ephemere.

## Essayer l API a la main

Un jeu de requetes pret a l'emploi couvrant les endpoints — y compris les 401 et 403
attendus, qui sont la meilleure demonstration du controle d acces.

**VS Code** — ouvrir [`backend/requests.http`](backend/requests.http) avec l'extension
REST Client (`humao.rest-client`) et cliquer sur « Send Request ». Les requetes se
chainent : lancer « Connexion » en premier, les suivantes reutilisent le jeton.

Cela suppose l API demarree (`npm run dev`) et utilise les comptes de demonstration
ci-dessus.

Pour la reinitialisation de mot de passe, le jeton n arrive pas dans la reponse mais par
courriel : en developpement, le lien est ecrit dans les logs de `npm run dev`, il suffit
de l y copier.

## Ajouter une ressource (exemple : `patients`)

1. `backend/src/models/patient.model.js` — acces aux donnees
2. `backend/src/services/patient.service.js` — logique metier
3. `backend/src/controllers/patient.controller.js` — req/res
4. `backend/src/routes/patient.routes.js` — puis monter la route dans `routes/index.js`
5. `frontend/src/api/patient.api.js` — appels via `apiClient`
6. `frontend/src/pages/PatientsPage.jsx` — la vue
