-- PayloadReady — Supabase / PostgreSQL schema
-- ------------------------------------------------------------
-- This schema is NOT required to run the app locally. The shipped MVP
-- uses a seeded, in-browser data layer (src/lib/store.ts) so it runs
-- immediately with `npm install && npm run dev`.
--
-- To activate a real backend later:
--   1. Create a Supabase project.
--   2. Run this file against it (SQL editor, or `supabase db push`).
--   3. Replace the Zustand store's local mutations with Supabase
--      client calls (the store's action signatures already match the
--      shape of these tables, so this is a swap of the persistence
--      layer, not a rewrite of the UI).
--   4. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
--      to .env.local.
-- ------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------- enums ----------

create type user_role as enum ('administrator', 'program_manager', 'engineer', 'reviewer', 'executive');
create type priority_level as enum ('low', 'medium', 'high', 'critical');
create type severity_level as enum ('low', 'medium', 'high', 'critical');
create type checklist_status as enum (
  'not_started', 'in_progress', 'submitted', 'under_review',
  'accepted', 'rejected', 'blocked', 'not_applicable'
);
create type evidence_review_status as enum (
  'draft', 'submitted', 'under_review', 'accepted', 'rejected', 'superseded'
);
create type evidence_type as enum (
  'test_report', 'analysis', 'certificate', 'drawing', 'interface_document',
  'safety_document', 'regulatory_filing', 'approval', 'shipping_record', 'other'
);
create type issue_state as enum ('open', 'monitoring', 'mitigating', 'resolved', 'accepted_risk');
create type decision_status as enum (
  'proposed', 'analysis_required', 'pending_approval', 'approved', 'rejected', 'deferred'
);
create type readiness_decision as enum ('ready', 'conditionally_ready', 'not_ready');
create type milestone_key as enum (
  'design_freeze', 'environmental_testing', 'documentation_submission',
  'payload_delivery', 'integration', 'launch'
);
create type milestone_status as enum ('complete', 'on_track', 'at_risk', 'missed');
create type checklist_category as enum (
  'mission_payload_definition', 'mechanical_interfaces', 'electrical_interfaces',
  'comms_rf', 'environmental_testing', 'safety_hazardous_systems',
  'regulatory_licensing', 'software_operational_readiness',
  'shipping_delivery', 'launch_provider_documentation'
);

-- ---------- core tables ----------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extends Supabase auth.users with app-specific profile fields.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  title text,
  avatar_color text,
  initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role user_role not null default 'engineer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  payload_name text not null,
  mission_type text not null,
  form_factor text,
  launch_provider text not null,
  integrator text not null,
  target_launch_date date not null,
  payload_delivery_date date not null,
  integration_date date not null,
  phase text not null,
  mission_lead_id uuid references users (id),
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_missions_org on missions (organization_id);

create table mission_members (
  mission_id uuid not null references missions (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role_on_mission text,
  created_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  key milestone_key not null,
  label text not null,
  date date not null,
  status milestone_status not null default 'on_track',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_milestones_mission on milestones (mission_id);

create table checklist_categories (
  key checklist_category primary key,
  label text not null,
  sort_order int not null
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  category checklist_category not null,
  title text not null,
  description text,
  requirement_source text,
  owner_id uuid references users (id),
  reviewer_id uuid references users (id),
  due_date date not null,
  priority priority_level not null default 'medium',
  status checklist_status not null default 'not_started',
  evidence_status text not null default 'none' check (evidence_status in ('none', 'pending', 'accepted', 'rejected')),
  notes text,
  related_issue_id uuid,
  not_applicable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_checklist_items_mission on checklist_items (mission_id);
create index idx_checklist_items_status on checklist_items (mission_id, status);
create index idx_checklist_items_owner on checklist_items (owner_id);

create table checklist_dependencies (
  checklist_item_id uuid not null references checklist_items (id) on delete cascade,
  depends_on_item_id uuid not null references checklist_items (id) on delete cascade,
  primary key (checklist_item_id, depends_on_item_id)
);

create table evidence_records (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  document_name text not null,
  document_number text,
  revision text not null default 'A',
  evidence_type evidence_type not null,
  uploaded_by uuid references users (id),
  submitted_date date not null default current_date,
  reviewer_id uuid references users (id),
  review_status evidence_review_status not null default 'draft',
  review_comments text,
  source_ref text,               -- Supabase Storage path, or simulated file metadata
  superseded boolean not null default false,
  supersedes_id uuid references evidence_records (id),
  version_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_evidence_mission on evidence_records (mission_id);
create index idx_evidence_status on evidence_records (mission_id, review_status);

create table checklist_evidence_links (
  checklist_item_id uuid not null references checklist_items (id) on delete cascade,
  evidence_id uuid not null references evidence_records (id) on delete cascade,
  primary key (checklist_item_id, evidence_id)
);

create table evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence_records (id) on delete cascade,
  reviewer_id uuid references users (id),
  status evidence_review_status not null,
  comments text,
  reviewed_at timestamptz not null default now()
);
create index idx_evidence_reviews_evidence on evidence_reviews (evidence_id);

create table issues (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  title text not null,
  description text,
  severity severity_level not null default 'medium',
  schedule_impact_days int not null default 0,
  affected_milestone milestone_key,
  owner_id uuid references users (id),
  due_date date,
  root_cause text,
  recovery_plan text,
  escalated boolean not null default false,
  state issue_state not null default 'open',
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_issues_mission on issues (mission_id);
create index idx_issues_state on issues (mission_id, state);

create table issue_checklist_links (
  issue_id uuid not null references issues (id) on delete cascade,
  checklist_item_id uuid not null references checklist_items (id) on delete cascade,
  primary key (issue_id, checklist_item_id)
);

create table recovery_actions (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues (id) on delete cascade,
  description text not null,
  owner_id uuid references users (id),
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_recovery_actions_issue on recovery_actions (issue_id);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  statement text not null,
  context text,
  options_considered text[] not null default '{}',
  owner_id uuid references users (id),
  approver_id uuid references users (id),
  due_date date,
  status decision_status not null default 'proposed',
  final_decision text,
  rationale text,
  date_decided date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_decisions_mission on decisions (mission_id);
create index idx_decisions_status on decisions (mission_id, status);

create table decision_links (
  decision_id uuid not null references decisions (id) on delete cascade,
  linked_type text not null check (linked_type in ('checklist_item', 'issue')),
  linked_id uuid not null,
  primary key (decision_id, linked_type, linked_id)
);

create table readiness_reviews (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  decision readiness_decision not null,
  score numeric(5, 2) not null,
  conditions jsonb,               -- [{ text, owner_id }]
  reasons text[],
  next_review_date date,
  comments text,
  recorded_by uuid references users (id),
  recorded_at timestamptz not null default now()
);
create index idx_readiness_reviews_mission on readiness_reviews (mission_id, recorded_at desc);

create table report_snapshots (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  generated_by uuid references users (id),
  readiness_score numeric(5, 2) not null,
  decision text,
  generated_at timestamptz not null default now()
);
create index idx_report_snapshots_mission on report_snapshots (mission_id, generated_at desc);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  actor_id uuid references users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  timestamp timestamptz not null default now()
);
create index idx_activity_mission on activity_events (mission_id, timestamp desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  message text not null,
  read boolean not null default false,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications (user_id, read);

create table templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,        -- e.g. 'cubesat_standard', 'hosted_payload'
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates (id) on delete cascade,
  category checklist_category not null,
  title text not null,
  description text,
  requirement_source text,
  priority priority_level not null default 'medium'
);
create index idx_template_items_template on template_items (template_id);

-- ---------- updated_at triggers ----------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'organizations', 'users', 'missions', 'milestones', 'checklist_items',
      'evidence_records', 'issues', 'recovery_actions', 'decisions'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function set_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------- row-level security ----------
-- Organization-scoped isolation: a user can only read/write rows for
-- organizations (and their missions) where they hold a membership.

alter table organizations enable row level security;
alter table users enable row level security;
alter table organization_members enable row level security;
alter table missions enable row level security;
alter table mission_members enable row level security;
alter table milestones enable row level security;
alter table checklist_items enable row level security;
alter table checklist_dependencies enable row level security;
alter table evidence_records enable row level security;
alter table checklist_evidence_links enable row level security;
alter table evidence_reviews enable row level security;
alter table issues enable row level security;
alter table issue_checklist_links enable row level security;
alter table recovery_actions enable row level security;
alter table decisions enable row level security;
alter table decision_links enable row level security;
alter table readiness_reviews enable row level security;
alter table report_snapshots enable row level security;
alter table activity_events enable row level security;
alter table notifications enable row level security;

create or replace function is_org_member(org_id uuid) returns boolean as $$
  select exists (
    select 1 from organization_members om
    where om.organization_id = org_id and om.user_id = auth.uid()
  );
$$ language sql stable security definer;

create or replace function mission_org(m_id uuid) returns uuid as $$
  select organization_id from missions where id = m_id;
$$ language sql stable security definer;

create policy "org members can read their organization"
  on organizations for select using (is_org_member(id));

create policy "org members can read profiles in their org"
  on users for select using (
    exists (
      select 1 from organization_members om1
      join organization_members om2 on om1.organization_id = om2.organization_id
      where om1.user_id = auth.uid() and om2.user_id = users.id
    )
  );

create policy "users can update their own profile"
  on users for update using (id = auth.uid());

create policy "org members can read membership rows"
  on organization_members for select using (is_org_member(organization_id));

create policy "administrators can manage membership"
  on organization_members for all using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role = 'administrator'
    )
  );

create policy "org members can read missions"
  on missions for select using (is_org_member(organization_id));
create policy "program managers and admins can write missions"
  on missions for insert with check (is_org_member(organization_id));
create policy "program managers and admins can update missions"
  on missions for update using (is_org_member(organization_id));

-- Mission-scoped tables all follow the same org-membership pattern via mission_org().
create policy "org members can read milestones" on milestones for select using (is_org_member(mission_org(mission_id)));
create policy "org members can write milestones" on milestones for all using (is_org_member(mission_org(mission_id)));

create policy "org members can read checklist items" on checklist_items for select using (is_org_member(mission_org(mission_id)));
create policy "org members can write checklist items" on checklist_items for all using (is_org_member(mission_org(mission_id)));

create policy "org members can read evidence" on evidence_records for select using (is_org_member(mission_org(mission_id)));
create policy "org members can write evidence" on evidence_records for all using (is_org_member(mission_org(mission_id)));

create policy "org members can read issues" on issues for select using (is_org_member(mission_org(mission_id)));
create policy "org members can write issues" on issues for all using (is_org_member(mission_org(mission_id)));

create policy "org members can read decisions" on decisions for select using (is_org_member(mission_org(mission_id)));
create policy "org members can write decisions" on decisions for all using (is_org_member(mission_org(mission_id)));

create policy "org members can read readiness reviews" on readiness_reviews for select using (is_org_member(mission_org(mission_id)));
create policy "program managers and admins can write readiness reviews" on readiness_reviews for insert with check (is_org_member(mission_org(mission_id)));

create policy "org members can read activity" on activity_events for select using (is_org_member(mission_org(mission_id)));
create policy "org members can write activity" on activity_events for insert with check (is_org_member(mission_org(mission_id)));

create policy "users can read their own notifications" on notifications for select using (user_id = auth.uid());
create policy "users can update their own notifications" on notifications for update using (user_id = auth.uid());

-- Executives are enforced at the application layer as read-only within
-- these same organization-scoped policies (see src/lib/store.ts action
-- guards once wired to Supabase; RLS here establishes the outer boundary
-- of "which rows", not the finer-grained "which role can write what").
