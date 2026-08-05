-- =============================================================================
-- BlueCare - schema PostgreSQL / Supabase
-- =============================================================================
-- A executer dans l'editeur SQL du projet Supabase, ou via `supabase db push`.
--
-- L'API Node est aujourd'hui branchee sur un stockage en memoire
-- (`src/models/store.js`). Ce fichier decrit la base cible : les tables
-- reprennent une a une les collections des modeles, de sorte que reecrire les
-- `*.model.js` avec `@supabase/supabase-js` suffise a basculer, sans toucher
-- aux services, controllers ni routes.
--
-- Deux facons d'utiliser les policies RLS definies plus bas :
--
--   1. API Node avec la cle `service_role` (cas actuel)
--      La cle contourne RLS. C'est le controle d'acces applicatif
--      (`middlewares/authorize.js` + `services/access.service.js`) qui fait foi.
--      Les policies restent une seconde barriere si une requete passe ailleurs.
--
--   2. Acces direct depuis le front, ou Node en connexion Postgres classique
--      Ouvrir chaque transaction par :
--          select set_config('app.user_id', '<uuid de l utilisateur>', true);
--      Les fonctions `app.current_user_id()` et `app.current_role()` lisent ce
--      reglage : les policies s'appliquent alors reellement.
-- =============================================================================

create extension if not exists "pgcrypto";

create schema if not exists app;

-- =============================================================================
-- Types metier (miroir de src/constants/domain.js et roles.js)
-- =============================================================================

create type app.user_role as enum ('educator', 'nurse', 'director', 'family');
create type app.user_status as enum ('active', 'disabled');

create type app.child_status as enum ('active', 'paused', 'archived');
create type app.disability_type as enum (
  'autism', 'intellectual', 'motor', 'visual', 'hearing',
  'language', 'behavioral', 'multiple', 'other'
);
create type app.gender as enum ('female', 'male', 'other');
create type app.contact_relationship as enum (
  'mother', 'father', 'guardian', 'grandparent', 'sibling', 'other'
);

create type app.attendance_status as enum ('present', 'late', 'absent', 'excused');

create type app.activity_category as enum (
  'arts', 'music', 'sport', 'cooking', 'outing',
  'sensory', 'learning', 'celebration', 'other'
);

create type app.goal_domain as enum (
  'communication', 'autonomy', 'motor', 'social',
  'cognitive', 'behavior', 'school', 'other'
);
create type app.goal_status as enum ('active', 'achieved', 'paused', 'abandoned');

create type app.session_type as enum (
  'individual', 'group', 'therapy', 'outing', 'family-meeting', 'other'
);
create type app.session_status as enum ('planned', 'completed', 'cancelled');

create type app.mood as enum ('very-difficult', 'difficult', 'neutral', 'good', 'very-good');

create type app.medication_route as enum ('oral', 'topical', 'inhaled', 'injection', 'other');
create type app.administration_status as enum ('given', 'refused', 'missed');

-- =============================================================================
-- Utilisateurs
-- =============================================================================

create table app.users (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  -- Hachage bcrypt produit par `src/utils/password.js`. Jamais expose par l'API.
  password_hash text not null,
  role          app.user_role not null,
  first_name    text not null,
  last_name     text not null,
  phone         text,
  status        app.user_status not null default 'active',
  -- Perimetre d'un educateur : les groupes dont il a la charge.
  groups        text[] not null default '{}',
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index users_role_idx on app.users (role) where status = 'active';

-- =============================================================================
-- Enfants
-- =============================================================================

create table app.children (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  birth_date  date not null,
  gender      app.gender,
  address     text,
  "group"     text not null,
  status      app.child_status not null default 'active',
  enrolled_at date not null default current_date,

  -- Objets de valeur : lus et ecrits d'un bloc, jamais interroges champ a champ.
  disability       jsonb not null,   -- { type, details, recognizedAt, supportPlan }
  referring_doctor jsonb,            -- { lastName, firstName, specialty, facility, phone... }

  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Deux fiches pour le meme enfant : refuse en base, pas seulement dans l'API.
  constraint children_identity_unique unique (first_name, last_name, birth_date),
  constraint children_disability_type_present
    check (disability ? 'type')
);

create index children_group_idx on app.children ("group") where status = 'active';
create index children_disability_type_idx on app.children ((disability ->> 'type'));

-- Rattachement des comptes « famille » a leurs enfants.
create table app.family_members (
  user_id  uuid not null references app.users (id) on delete cascade,
  child_id uuid not null references app.children (id) on delete cascade,
  primary key (user_id, child_id)
);

create index family_members_child_idx on app.family_members (child_id);

-- Contacts famille de la fiche enfant (differents des comptes utilisateurs).
create table app.family_contacts (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references app.children (id) on delete cascade,
  first_name   text,
  last_name    text not null,
  relationship app.contact_relationship not null,
  phone        text not null,
  email        citext,
  address      text,
  notes        text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index family_contacts_child_idx on app.family_contacts (child_id);
-- Un seul contact principal par enfant.
create unique index family_contacts_single_primary_idx
  on app.family_contacts (child_id) where is_primary;

-- =============================================================================
-- Presences
-- =============================================================================

create table app.attendance (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references app.children (id) on delete cascade,
  date           date not null,
  status         app.attendance_status not null,
  arrival_time   time,
  departure_time time,
  reason         text,
  notes          text,
  recorded_by    uuid references app.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Une seule saisie par enfant et par jour : c'est ce que garantit
  -- `attendanceKey()` cote memoire.
  constraint attendance_child_date_unique unique (child_id, date),
  constraint attendance_reason_required_when_excused
    check (status <> 'excused' or reason is not null),
  constraint attendance_arrival_required_when_late
    check (status <> 'late' or arrival_time is not null),
  constraint attendance_not_in_future check (date <= current_date)
);

-- Le moteur d'alertes lit toujours « un enfant, une fenetre de dates ».
create index attendance_child_date_idx on app.attendance (child_id, date desc);
create index attendance_date_idx on app.attendance (date);

-- =============================================================================
-- Activites et galerie
-- =============================================================================

create table app.activities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  category    app.activity_category not null,
  date        date not null,
  "group"     text,
  location    text,
  created_by  uuid references app.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index activities_date_idx on app.activities (date desc);

create table app.activity_participants (
  activity_id uuid not null references app.activities (id) on delete cascade,
  child_id    uuid not null references app.children (id) on delete cascade,
  primary key (activity_id, child_id)
);

create index activity_participants_child_idx on app.activity_participants (child_id);

-- Fichiers deposes dans Supabase Storage : on ne garde ici que le chemin.
create table app.activity_media (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references app.activities (id) on delete cascade,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now()
);

create index activity_media_activity_idx on app.activity_media (activity_id);

-- =============================================================================
-- Suivi pedagogique
-- =============================================================================

create table app.goals (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references app.children (id) on delete cascade,
  title            text not null,
  description      text,
  domain           app.goal_domain not null,
  baseline         text,
  success_criteria text,
  start_date       date not null default current_date,
  target_date      date,
  status           app.goal_status not null default 'active',
  progress         smallint not null default 0,
  achieved_at      date,
  created_by       uuid references app.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint goals_progress_range check (progress between 0 and 100),
  constraint goals_target_after_start check (target_date is null or target_date >= start_date),
  -- Un objectif atteint est a 100 %, et reciproquement.
  constraint goals_achieved_is_complete
    check ((status = 'achieved') = (progress = 100 and achieved_at is not null))
);

create index goals_child_idx on app.goals (child_id, status);

create table app.sessions (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references app.children (id) on delete cascade,
  educator_id   uuid references app.users (id) on delete set null,
  title         text,
  date          date not null,
  start_time    time,
  end_time      time,
  type          app.session_type not null,
  location      text,
  notes         text,
  status        app.session_status not null default 'planned',
  cancel_reason text,
  created_by    uuid references app.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint sessions_end_after_start
    check (end_time is null or start_time is null or end_time >= start_time),
  -- Une seance a venir ne peut pas etre deja realisee.
  constraint sessions_completed_not_in_future
    check (status <> 'completed' or date <= current_date)
);

create index sessions_child_date_idx on app.sessions (child_id, date desc);
create index sessions_planned_idx on app.sessions (date) where status = 'planned';

-- Objectifs prevus au programme d'une seance.
create table app.session_goals (
  session_id uuid not null references app.sessions (id) on delete cascade,
  goal_id    uuid not null references app.goals (id) on delete cascade,
  primary key (session_id, goal_id)
);

create table app.reports (
  id               uuid primary key default gen_random_uuid(),
  -- Un compte-rendu par seance : la contrainte unique porte la regle.
  session_id       uuid not null unique references app.sessions (id) on delete cascade,
  child_id         uuid not null references app.children (id) on delete cascade,
  date             date not null,
  author_id        uuid references app.users (id) on delete set null,
  mood             app.mood not null,
  mood_comment     text,
  observations     text not null,
  attention_points text[] not null default '{}',
  next_steps       text,
  -- Signalement transmis a l'infirmiere.
  health_flagged     boolean not null default false,
  health_description text,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint reports_observations_not_empty check (length(observations) >= 10),
  constraint reports_health_description_required
    check (not health_flagged or health_description is not null)
);

create index reports_child_date_idx on app.reports (child_id, date desc);
create index reports_health_idx on app.reports (date desc) where health_flagged;

-- Taux d'avancement releve pour un objectif pendant une seance.
-- C'est la table qui alimente les courbes d'evolution sur six mois.
create table app.report_goal_progress (
  report_id uuid not null references app.reports (id) on delete cascade,
  goal_id   uuid not null references app.goals (id) on delete cascade,
  progress  smallint not null,
  worked    boolean not null default true,
  comment   text,
  primary key (report_id, goal_id),

  constraint report_goal_progress_range check (progress between 0 and 100)
);

create index report_goal_progress_goal_idx on app.report_goal_progress (goal_id);

-- =============================================================================
-- Suivi medical
-- =============================================================================

create table app.medications (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references app.children (id) on delete cascade,
  name          text not null,
  dosage        text not null,
  route         app.medication_route not null default 'oral',
  -- { times: ['08:00','12:00'], days: [1..7] }, days vide = tous les jours.
  schedule      jsonb not null,
  start_date    date not null,
  end_date      date,
  prescribed_by text,
  instructions  text,
  active        boolean not null default true,
  created_by    uuid references app.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint medications_end_after_start check (end_date is null or end_date >= start_date),
  constraint medications_schedule_has_times check (schedule ? 'times')
);

create index medications_child_idx on app.medications (child_id) where active;

create table app.medication_administrations (
  id             uuid primary key default gen_random_uuid(),
  medication_id  uuid not null references app.medications (id) on delete cascade,
  child_id       uuid not null references app.children (id) on delete cascade,
  date           date not null,
  scheduled_time time not null,
  status         app.administration_status not null,
  given_at       time,
  notes          text,
  recorded_by    uuid references app.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Une prise par traitement, par jour et par horaire prevu.
  constraint administrations_unique unique (medication_id, date, scheduled_time)
);

create index administrations_date_idx on app.medication_administrations (date);

-- =============================================================================
-- Notifications
-- =============================================================================
-- Le fil de notifications est CALCULE par l'API (voir notification.service.js).
-- Seuls l'acquittement et les abonnements sont persistes : eux ne se deduisent
-- d'aucune donnee metier.

create table app.notification_reads (
  user_id         uuid not null references app.users (id) on delete cascade,
  notification_id text not null,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create table app.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app.users (id) on delete cascade,
  endpoint   text not null,
  platform   text not null default 'web',
  keys       jsonb,
  created_at timestamptz not null default now(),

  constraint push_subscriptions_unique unique (user_id, endpoint)
);

-- =============================================================================
-- Mise a jour automatique de updated_at
-- =============================================================================

create or replace function app.touch_updated_at() returns trigger
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
    'sessions', 'reports', 'medications', 'medication_administrations'
  ]
  loop
    execute format(
      'create trigger %I_touch before update on app.%I
         for each row execute function app.touch_updated_at()',
      target, target
    );
  end loop;
end;
$$;

-- =============================================================================
-- Perimetre : les memes regles que services/access.service.js, cote base
-- =============================================================================

-- Identifiant de l'appelant, pose par la couche applicative :
--   select set_config('app.user_id', '<uuid>', true);
create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function app.current_role() returns app.user_role
language sql stable as $$
  select role from app.users where id = app.current_user_id() and status = 'active';
$$;

create or replace function app.has_full_scope() returns boolean
language sql stable as $$
  select app.current_role() in ('director', 'nurse');
$$;

create or replace function app.is_read_only() returns boolean
language sql stable as $$
  select app.current_role() = 'family';
$$;

/*
  Un enfant est-il dans le perimetre de l'appelant ?
    directeur / infirmiere : tout le centre
    educateur              : les enfants de ses groupes
    famille                : ses propres enfants
*/
create or replace function app.can_access_child(target_child uuid) returns boolean
language sql stable as $$
  select case app.current_role()
    when 'director' then true
    when 'nurse'    then true
    when 'educator' then exists (
      select 1
      from app.children c
      join app.users u on u.id = app.current_user_id()
      where c.id = target_child and c."group" = any (u.groups)
    )
    when 'family' then exists (
      select 1 from app.family_members fm
      where fm.child_id = target_child and fm.user_id = app.current_user_id()
    )
    else false
  end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table app.users                     enable row level security;
alter table app.children                  enable row level security;
alter table app.family_members            enable row level security;
alter table app.family_contacts           enable row level security;
alter table app.attendance                enable row level security;
alter table app.activities                enable row level security;
alter table app.activity_participants     enable row level security;
alter table app.activity_media            enable row level security;
alter table app.goals                     enable row level security;
alter table app.sessions                  enable row level security;
alter table app.session_goals             enable row level security;
alter table app.reports                   enable row level security;
alter table app.report_goal_progress      enable row level security;
alter table app.medications               enable row level security;
alter table app.medication_administrations enable row level security;
alter table app.notification_reads        enable row level security;
alter table app.push_subscriptions        enable row level security;

-- Comptes : chacun se voit, seul le directeur voit et gere les autres.
create policy users_self_read on app.users
  for select using (id = app.current_user_id() or app.current_role() = 'director');
create policy users_director_write on app.users
  for all using (app.current_role() = 'director')
  with check (app.current_role() = 'director');

-- Enfants : lecture dans le perimetre, ecriture pour la direction et l'infirmiere.
create policy children_scoped_read on app.children
  for select using (app.can_access_child(id));
create policy children_staff_write on app.children
  for all using (app.current_role() in ('director', 'nurse'))
  with check (app.current_role() in ('director', 'nurse'));

create policy family_members_read on app.family_members
  for select using (user_id = app.current_user_id() or app.current_role() = 'director');
create policy family_members_director_write on app.family_members
  for all using (app.current_role() = 'director')
  with check (app.current_role() = 'director');

create policy family_contacts_scoped on app.family_contacts
  for select using (app.can_access_child(child_id));
create policy family_contacts_write on app.family_contacts
  for all using (app.current_role() in ('director', 'nurse'))
  with check (app.current_role() in ('director', 'nurse'));

-- Presences : lecture dans le perimetre, saisie interdite aux familles.
create policy attendance_scoped_read on app.attendance
  for select using (app.can_access_child(child_id));
create policy attendance_staff_write on app.attendance
  for all using (app.can_access_child(child_id) and not app.is_read_only())
  with check (app.can_access_child(child_id) and not app.is_read_only());

-- Activites : visibles des qu'un participant est dans le perimetre.
-- L'anonymisation de la galerie reste faite par l'API (utils/anonymize.js).
create policy activities_scoped_read on app.activities
  for select using (
    exists (
      select 1 from app.activity_participants ap
      where ap.activity_id = id and app.can_access_child(ap.child_id)
    )
  );
create policy activities_staff_write on app.activities
  for all using (app.current_role() in ('educator', 'director'))
  with check (app.current_role() in ('educator', 'director'));

create policy activity_participants_scoped on app.activity_participants
  for select using (app.can_access_child(child_id));
create policy activity_participants_write on app.activity_participants
  for all using (app.current_role() in ('educator', 'director'))
  with check (app.current_role() in ('educator', 'director'));

create policy activity_media_scoped on app.activity_media
  for select using (
    exists (
      select 1 from app.activity_participants ap
      where ap.activity_id = activity_id and app.can_access_child(ap.child_id)
    )
  );
create policy activity_media_write on app.activity_media
  for all using (app.current_role() in ('educator', 'director'))
  with check (app.current_role() in ('educator', 'director'));

-- Objectifs : la famille les lit (c'est la progression de son enfant), sans les modifier.
create policy goals_scoped_read on app.goals
  for select using (app.can_access_child(child_id));
create policy goals_pedagogy_write on app.goals
  for all using (app.can_access_child(child_id) and app.current_role() in ('educator', 'director'))
  with check (app.can_access_child(child_id) and app.current_role() in ('educator', 'director'));

-- Seances et comptes-rendus : internes a l'equipe, la famille n'y accede pas.
create policy sessions_staff_read on app.sessions
  for select using (app.can_access_child(child_id) and not app.is_read_only());
create policy sessions_pedagogy_write on app.sessions
  for all using (app.can_access_child(child_id) and app.current_role() in ('educator', 'director'))
  with check (app.can_access_child(child_id) and app.current_role() in ('educator', 'director'));

create policy session_goals_staff on app.session_goals
  for all using (
    exists (
      select 1 from app.sessions s
      where s.id = session_id and app.can_access_child(s.child_id) and not app.is_read_only()
    )
  )
  with check (app.current_role() in ('educator', 'director'));

create policy reports_staff_read on app.reports
  for select using (app.can_access_child(child_id) and not app.is_read_only());
create policy reports_pedagogy_write on app.reports
  for all using (app.can_access_child(child_id) and app.current_role() in ('educator', 'director'))
  with check (app.can_access_child(child_id) and app.current_role() in ('educator', 'director'));

create policy report_goal_progress_staff on app.report_goal_progress
  for all using (
    exists (
      select 1 from app.reports r
      where r.id = report_id and app.can_access_child(r.child_id) and not app.is_read_only()
    )
  )
  with check (app.current_role() in ('educator', 'director'));

-- Donnees medicales : infirmiere et direction, sans exception.
create policy medications_medical_only on app.medications
  for all using (app.current_role() in ('nurse', 'director'))
  with check (app.current_role() in ('nurse', 'director'));

create policy administrations_medical_only on app.medication_administrations
  for all using (app.current_role() in ('nurse', 'director'))
  with check (app.current_role() in ('nurse', 'director'));

-- Notifications : strictement personnelles.
create policy notification_reads_own on app.notification_reads
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy push_subscriptions_own on app.push_subscriptions
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

-- =============================================================================
-- Supabase Storage
-- =============================================================================
-- Deux buckets prives : aucun fichier n'est servi en acces public direct.
--
--   insert into storage.buckets (id, name, public) values
--     ('activity-media', 'activity-media', false),
--     ('reports',        'reports',        false);
--
-- L'API delivre des URLs signees a duree limitee, pour que les photos et les
-- rapports PDF ne soient pas accessibles par simple partage d'adresse.
