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
    └── src/
        ├── server.js       # demarrage HTTP uniquement
        ├── app.js          # construction de l'app Express (testable seule)
        ├── config/         # lecture et validation de l'environnement
        ├── routes/         # declaration des URLs
        ├── controllers/    # req/res -> service -> reponse
        ├── services/       # logique metier (ne connait pas Express)
        ├── models/         # acces aux donnees
        ├── middlewares/    # erreurs, auth, validation
        └── utils/          # logger, ApiError, asyncHandler
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
ne sont pas versionnes, seuls les `.env.example` le sont.

## Ajouter une ressource (exemple : `patients`)

1. `backend/src/models/patient.model.js` — acces aux donnees
2. `backend/src/services/patient.service.js` — logique metier
3. `backend/src/controllers/patient.controller.js` — req/res
4. `backend/src/routes/patient.routes.js` — puis monter la route dans `routes/index.js`
5. `frontend/src/api/patient.api.js` — appels via `apiClient`
6. `frontend/src/pages/PatientsPage.jsx` — la vue
