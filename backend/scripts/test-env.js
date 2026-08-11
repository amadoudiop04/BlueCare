/**
 * Precharge par `npm test` (option `--import`), avant tout autre module.
 *
 * La suite de tests doit tourner sur le stockage en memoire : elle cree et
 * detruit librement des comptes et des dossiers d'enfants. Or `config/env.js`
 * lit `backend/.env` via dotenv, si bien qu'une machine configuree pour
 * Supabase faisait ecrire les tests dans la vraie base — donnees de test
 * melangees aux dossiers reels, et suite en echec par-dessus le marche.
 *
 * On neutralise donc les clefs ici. La chaine vide, plutot qu'un `delete` :
 * dotenv n'ecrase jamais une variable deja definie, alors qu'une variable
 * supprimee serait aussitot rechargee depuis le `.env`. Et `env.js` ne retient
 * l'URL que si elle est non vide, ce qui selectionne le pilote memoire.
 */
process.env.SUPABASE_URL = ''
process.env.SUPABASE_SECRET_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.SUPABASE_PUBLISHABLE_KEY = ''
process.env.SUPABASE_ANON_KEY = ''
