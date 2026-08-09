-- =============================================================================
-- BlueCare - schema PostgreSQL / Supabase
-- =============================================================================
-- A executer une fois dans l'editeur SQL du projet Supabase
-- (Dashboard > SQL Editor > New query > coller > Run).
--
-- Le schema colle volontairement aux formes manipulees par `src/models/` :
--
--   * les identifiants sont du TEXTE prefixe (`chd_...`, `ses_...`) et non des
--     uuid nus. Le prefixe dit de quelle table vient un identifiant quand on
--     le lit dans un log ou une URL, et cela evite de reecrire le code qui les
--     produit deja sous cette forme.
--
--   * ce que l application lit et ecrit toujours d un bloc reste groupe :
--     `family_contacts`, `media`, `goal_progress` en JSONB, `participant_ids`
--     et `goal_ids` en tableaux. Normaliser ces quatre-la imposerait une
--     jointure a chaque lecture sans rien apporter : aucune requete du produit
--     ne les interroge separement.
--
--   * ce qui est reellement relationnel garde ses cles etrangeres : une
--     presence, un objectif, une seance et un compte-rendu pointent vers leur
--     enfant, et disparaissent avec lui.
--
--   * les heures sont du texte `HH:MM`. Le type `time` renverrait `08:45:00`
--     qu il faudrait retailler a chaque lecture ; l application ne fait que
--     les comparer, ce que l'ordre lexicographique donne deja.
-- =============================================================================

create extension if not exists citext;

-- =============================================================================
-- Utilisateurs
-- =============================================================================

create table if not exists public.users (
  id            text primary key,
  email         citext not null unique,
  -- Hachage bcrypt produit par `src/utils/password.js`. L API ne le renvoie
  -- jamais : les modeles le retirent avant toute sortie (`sanitizeUser`).
  password_hash text not null,
  role          text not null
                  check (role in ('educator', 'nurse', 'director', 'family', 'admin')),
  first_name    text not null,
  last_name     text not null,
  phone         text,
  status        text not null default 'active' check (status in ('active', 'disabled')),
  -- Perimetre : groupes pour un educateur, enfants rattaches pour une famille.
  groups        text[] not null default '{}',
  child_ids     text[] not null default '{}',
  last_login_at timestamptz,

  -- --- Double authentification (TOTP) ---------------------------------------
  -- Secret base32 partage avec l application d authentification. Comme le
  -- hachage du mot de passe, il ne sort jamais de l API (voir models/sanitize.js).
  totp_secret        text,
  totp_enabled       boolean not null default false,
  totp_confirmed_at  timestamptz,
  -- Dernier pas de temps consomme : empeche de rejouer un code intercepte
  -- pendant les 30 secondes ou il reste mathematiquement valable.
  totp_last_step     bigint,
  -- Hachages bcrypt des codes de secours, consommes un par un.
  recovery_codes     text[] not null default '{}',
  -- Verrouillage temporaire apres trop d'echecs de code.
  mfa_failed_attempts integer not null default 0,
  mfa_locked_until    timestamptz,

  -- --- Reinitialisation de mot de passe --------------------------------------
  -- Comme pour les sessions, seul le hachage du jeton est conserve : une copie
  -- de la base ne permet pas de rejouer un lien en cours de validite.
  -- Un seul lien actif par compte : en redemander un invalide le precedent.
  reset_token_hash  text,
  reset_expires_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Un secret sans activation est un brouillon d'enrolement ; l'inverse
  -- (active sans secret) serait un compte impossible a deverrouiller.
  constraint users_totp_needs_secret check (not totp_enabled or totp_secret is not null)
);

create index if not exists users_active_role_idx on public.users (role) where status = 'active';

-- =============================================================================
-- Sessions de connexion
-- =============================================================================
-- Le navigateur ne conserve qu un cookie httpOnly ; la session elle-meme vit
-- ici. Cela la rend revocable sur-le-champ (supprimer la ligne suffit) et
-- permet d'afficher les appareils connectes.
--
-- Seul le HACHAGE du jeton est stocke : une copie de la base ne permet pas de
-- rejouer les sessions en cours.

create table if not exists public.auth_sessions (
  id           text primary key,
  user_id      text not null references public.users (id) on delete cascade,
  token_hash   text not null unique,
  user_agent   text,
  ip           text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  updated_at   timestamptz not null default now()
);

create index if not exists auth_sessions_user_idx on public.auth_sessions (user_id);
-- Le menage des sessions expirees passe par cet index.
create index if not exists auth_sessions_expiry_idx on public.auth_sessions (expires_at);

-- =============================================================================
-- Enfants
-- =============================================================================

create table if not exists public.children (
  id          text primary key,
  first_name  text not null,
  last_name   text not null,
  birth_date  date not null,
  gender      text check (gender in ('female', 'male', 'other')),
  address     text,
  "group"     text not null,
  status      text not null default 'active' check (status in ('active', 'paused', 'archived')),
  enrolled_at date not null default current_date,

  -- { type, details, recognizedAt, supportPlan }
  disability  jsonb not null,
  -- [{ id, firstName, lastName, relationship, phone, email, isPrimary... }]
  family_contacts  jsonb not null default '[]'::jsonb,
  -- { lastName, firstName, specialty, facility, phone... } ou null
  referring_doctor jsonb,

  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Deux fiches pour le meme enfant : refuse par la base, pas seulement par l API.
  constraint children_identity_unique unique (first_name, last_name, birth_date),
  constraint children_disability_typed check (disability ? 'type')
);

create index if not exists children_group_idx on public.children ("group") where status = 'active';
create index if not exists children_disability_idx on public.children ((disability ->> 'type'));

-- =============================================================================
-- Presences
-- =============================================================================

create table if not exists public.attendance (
  id             text primary key,
  child_id       text not null references public.children (id) on delete cascade,
  date           date not null,
  status         text not null check (status in ('present', 'late', 'absent', 'excused')),
  arrival_time   text check (arrival_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  departure_time text check (departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reason         text,
  notes          text,
  recorded_by    text references public.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Une seule saisie par enfant et par jour.
  constraint attendance_child_date_unique unique (child_id, date),
  constraint attendance_reason_when_excused check (status <> 'excused' or reason is not null),
  constraint attendance_arrival_when_late check (status <> 'late' or arrival_time is not null),
  constraint attendance_not_future check (date <= current_date)
);

-- Le moteur d alertes lit toujours « un enfant, une fenetre de dates ».
create index if not exists attendance_child_date_idx on public.attendance (child_id, date desc);
create index if not exists attendance_date_idx on public.attendance (date);

-- =============================================================================
-- Activites et galerie
-- =============================================================================

create table if not exists public.activities (
  id              text primary key,
  title           text not null,
  description     text,
  category        text not null,
  date            date not null,
  "group"         text,
  location        text,
  participant_ids text[] not null default '{}',
  -- [{ id, url, caption }] — chemins Supabase Storage une fois l'upload branche.
  media           jsonb not null default '[]'::jsonb,
  created_by      text references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists activities_date_idx on public.activities (date desc);
-- « les activites de cet enfant » est la requete de la galerie : index GIN.
create index if not exists activities_participants_idx on public.activities using gin (participant_ids);

-- =============================================================================
-- Suivi pedagogique
-- =============================================================================

create table if not exists public.goals (
  id               text primary key,
  child_id         text not null references public.children (id) on delete cascade,
  title            text not null,
  description      text,
  domain           text not null,
  baseline         text,
  success_criteria text,
  start_date       date not null default current_date,
  target_date      date,
  status           text not null default 'active'
                     check (status in ('active', 'achieved', 'paused', 'abandoned')),
  progress         smallint not null default 0 check (progress between 0 and 100),
  achieved_at      date,
  created_by       text references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint goals_target_after_start check (target_date is null or target_date >= start_date),
  -- Un objectif atteint est a 100 %, et reciproquement.
  constraint goals_achieved_is_complete
    check ((status = 'achieved') = (progress = 100 and achieved_at is not null))
);

create index if not exists goals_child_idx on public.goals (child_id, status);

create table if not exists public.sessions (
  id            text primary key,
  child_id      text not null references public.children (id) on delete cascade,
  educator_id   text references public.users (id) on delete set null,
  title         text,
  date          date not null,
  start_time    text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time      text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  type          text not null,
  location      text,
  notes         text,
  status        text not null default 'planned'
                  check (status in ('planned', 'completed', 'cancelled')),
  cancel_reason text,
  goal_ids      text[] not null default '{}',
  created_by    text references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint sessions_end_after_start
    check (end_time is null or start_time is null or end_time >= start_time),
  constraint sessions_completed_not_future check (status <> 'completed' or date <= current_date)
);

create index if not exists sessions_child_date_idx on public.sessions (child_id, date desc);
create index if not exists sessions_planned_idx on public.sessions (date) where status = 'planned';

create table if not exists public.reports (
  id               text primary key,
  -- Un compte-rendu par seance : la contrainte unique porte la regle.
  session_id       text not null unique references public.sessions (id) on delete cascade,
  child_id         text not null references public.children (id) on delete cascade,
  date             date not null,
  author_id        text references public.users (id) on delete set null,
  mood             text not null
                     check (mood in ('very-difficult', 'difficult', 'neutral', 'good', 'very-good')),
  mood_comment     text,
  -- [{ goalId, progress, worked, comment }] — source des courbes d evolution.
  goal_progress    jsonb not null default '[]'::jsonb,
  observations     text not null check (length(observations) >= 10),
  attention_points text[] not null default '{}',
  next_steps       text,
  -- { flagged, description } — un signalement transmis a l infirmiere.
  health_flag      jsonb not null default '{"flagged": false, "description": null}'::jsonb,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint reports_health_described
    check (not (health_flag ->> 'flagged')::boolean or health_flag ->> 'description' is not null)
);

create index if not exists reports_child_date_idx on public.reports (child_id, date desc);
create index if not exists reports_health_idx on public.reports (date desc)
  where (health_flag ->> 'flagged')::boolean;

-- =============================================================================
-- Suivi medical
-- =============================================================================

create table if not exists public.medications (
  id            text primary key,
  child_id      text not null references public.children (id) on delete cascade,
  name          text not null,
  dosage        text not null,
  route         text not null default 'oral',
  -- { times: ['08:00','12:00'], days: [1..7] } — days vide = tous les jours.
  schedule      jsonb not null,
  start_date    date not null,
  end_date      date,
  prescribed_by text,
  instructions  text,
  active        boolean not null default true,
  created_by    text references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint medications_end_after_start check (end_date is null or end_date >= start_date),
  constraint medications_schedule_has_times check (schedule ? 'times')
);

create index if not exists medications_child_idx on public.medications (child_id) where active;

create table if not exists public.medication_administrations (
  id             text primary key,
  medication_id  text not null references public.medications (id) on delete cascade,
  child_id       text not null references public.children (id) on delete cascade,
  date           date not null,
  scheduled_time text not null check (scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status         text not null check (status in ('given', 'refused', 'missed')),
  given_at       text check (given_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  notes          text,
  recorded_by    text references public.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Une prise par traitement, par jour et par horaire prevu.
  constraint administrations_unique unique (medication_id, date, scheduled_time)
);

create index if not exists administrations_date_idx on public.medication_administrations (date);

-- =============================================================================
-- Notifications
-- =============================================================================
-- Le fil est CALCULE a la demande (voir `notification.service.js`). Seuls
-- l'acquittement et les abonnements sont stockes : eux ne se deduisent
-- d'aucune donnee metier.

create table if not exists public.notification_reads (
  user_id         text not null references public.users (id) on delete cascade,
  notification_id text not null,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create table if not exists public.push_subscriptions (
  id         text primary key,
  user_id    text not null references public.users (id) on delete cascade,
  endpoint   text not null,
  platform   text not null default 'web',
  keys       jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_unique unique (user_id, endpoint)
);

-- =============================================================================
-- updated_at automatique
-- =============================================================================

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'users', 'children', 'attendance', 'activities', 'goals',
    'sessions', 'reports', 'medications', 'medication_administrations',
    'push_subscriptions', 'auth_sessions'
  ]
  loop
    execute format('drop trigger if exists %I_touch on public.%I', target, target);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()',
      target, target
    );
  end loop;
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- L API Node se connecte avec la cle `service_role`, qui contourne RLS : c'est
-- le controle d acces applicatif (`middlewares/authorize.js` +
-- `services/access.service.js`) qui fait foi, et lui seul est teste.
--
-- Ces policies sont une seconde barriere, utile le jour ou le front parlerait
-- directement a Supabase, ou si la cle `anon` fuitait. Elles ne s'appliquent
-- qu'aux connexions qui NE sont PAS service_role, et attendent que l'appelant
-- ait ete identifie par :
--     select set_config('app.user_id', '<id utilisateur>', true);

create or replace function public.current_app_user() returns text
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '');
$$;

create or replace function public.current_app_role() returns text
language sql stable as $$
  select role from public.users where id = public.current_app_user() and status = 'active';
$$;

/*
  Un enfant est-il dans le perimetre de l'appelant ?
    directeur / infirmiere : tout le centre
    educateur              : les enfants de ses groupes
    famille                : ses propres enfants
*/
create or replace function public.can_access_child(target_child text) returns boolean
language sql stable as $$
  select case public.current_app_role()
    when 'director' then true
    when 'nurse'    then true
    when 'educator' then exists (
      select 1 from public.children c
      join public.users u on u.id = public.current_app_user()
      where c.id = target_child and c."group" = any (u.groups)
    )
    when 'family' then exists (
      select 1 from public.users u
      where u.id = public.current_app_user() and target_child = any (u.child_ids)
    )
    else false
  end;
$$;

alter table public.users                      enable row level security;
alter table public.auth_sessions              enable row level security;
alter table public.children                   enable row level security;
alter table public.attendance                 enable row level security;
alter table public.activities                 enable row level security;
alter table public.goals                      enable row level security;
alter table public.sessions                   enable row level security;
alter table public.reports                    enable row level security;
alter table public.medications                enable row level security;
alter table public.medication_administrations enable row level security;
alter table public.notification_reads         enable row level security;
alter table public.push_subscriptions         enable row level security;

-- Une session n'appartient qu'a son proprietaire ; personne d autre ne la lit.
drop policy if exists auth_sessions_own on public.auth_sessions;
create policy auth_sessions_own on public.auth_sessions
  for all using (user_id = public.current_app_user())
  with check (user_id = public.current_app_user());

drop policy if exists users_self_or_director on public.users;
create policy users_self_or_director on public.users
  for select using (id = public.current_app_user() or public.current_app_role() = 'director');

drop policy if exists users_director_writes on public.users;
create policy users_director_writes on public.users
  for all using (public.current_app_role() = 'director')
  with check (public.current_app_role() = 'director');

drop policy if exists children_scoped_read on public.children;
create policy children_scoped_read on public.children
  for select using (public.can_access_child(id));

drop policy if exists children_staff_write on public.children;
create policy children_staff_write on public.children
  for all using (public.current_app_role() in ('director', 'nurse'))
  with check (public.current_app_role() in ('director', 'nurse'));

drop policy if exists attendance_scoped on public.attendance;
create policy attendance_scoped on public.attendance
  for select using (public.can_access_child(child_id));

drop policy if exists attendance_staff_write on public.attendance;
create policy attendance_staff_write on public.attendance
  for all using (public.can_access_child(child_id) and public.current_app_role() <> 'family')
  with check (public.can_access_child(child_id) and public.current_app_role() <> 'family');

-- L'anonymisation de la galerie reste faite par l API (`utils/anonymize.js`) :
-- RLS filtre les lignes, elle ne reecrit pas leur contenu.
drop policy if exists activities_scoped_read on public.activities;
create policy activities_scoped_read on public.activities
  for select using (
    exists (select 1 from unnest(participant_ids) as p (id) where public.can_access_child(p.id))
  );

drop policy if exists activities_staff_write on public.activities;
create policy activities_staff_write on public.activities
  for all using (public.current_app_role() in ('educator', 'director'))
  with check (public.current_app_role() in ('educator', 'director'));

-- La famille lit les objectifs : c est la progression de son enfant.
drop policy if exists goals_scoped_read on public.goals;
create policy goals_scoped_read on public.goals
  for select using (public.can_access_child(child_id));

drop policy if exists goals_pedagogy_write on public.goals;
create policy goals_pedagogy_write on public.goals
  for all using (public.can_access_child(child_id)
                 and public.current_app_role() in ('educator', 'director'))
  with check (public.can_access_child(child_id)
              and public.current_app_role() in ('educator', 'director'));

-- Seances et comptes-rendus : internes a l equipe.
drop policy if exists sessions_staff_read on public.sessions;
create policy sessions_staff_read on public.sessions
  for select using (public.can_access_child(child_id) and public.current_app_role() <> 'family');

drop policy if exists sessions_pedagogy_write on public.sessions;
create policy sessions_pedagogy_write on public.sessions
  for all using (public.can_access_child(child_id)
                 and public.current_app_role() in ('educator', 'director'))
  with check (public.can_access_child(child_id)
              and public.current_app_role() in ('educator', 'director'));

drop policy if exists reports_staff_read on public.reports;
create policy reports_staff_read on public.reports
  for select using (public.can_access_child(child_id) and public.current_app_role() <> 'family');

drop policy if exists reports_pedagogy_write on public.reports;
create policy reports_pedagogy_write on public.reports
  for all using (public.can_access_child(child_id)
                 and public.current_app_role() in ('educator', 'director'))
  with check (public.can_access_child(child_id)
              and public.current_app_role() in ('educator', 'director'));

-- Donnees medicales : infirmiere et direction, sans exception.
drop policy if exists medications_medical_only on public.medications;
create policy medications_medical_only on public.medications
  for all using (public.current_app_role() in ('nurse', 'director'))
  with check (public.current_app_role() in ('nurse', 'director'));

drop policy if exists administrations_medical_only on public.medication_administrations;
create policy administrations_medical_only on public.medication_administrations
  for all using (public.current_app_role() in ('nurse', 'director'))
  with check (public.current_app_role() in ('nurse', 'director'));

-- Notifications : strictement personnelles.
drop policy if exists notification_reads_own on public.notification_reads;
create policy notification_reads_own on public.notification_reads
  for all using (user_id = public.current_app_user())
  with check (user_id = public.current_app_user());

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all using (user_id = public.current_app_user())
  with check (user_id = public.current_app_user());

-- =============================================================================
-- Supabase Storage (a activer quand l'upload de fichiers sera branche)
-- =============================================================================
-- Deux buckets prives : aucun fichier n'est servi en acces public direct.
--
--   insert into storage.buckets (id, name, public) values
--     ('activity-media', 'activity-media', false),
--     ('reports',        'reports',        false)
--   on conflict (id) do nothing;
--
-- L API delivrera des URLs signees a duree limitee, pour que les photos et les
-- rapports PDF ne soient pas accessibles par simple partage d'adresse.
