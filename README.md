# PayloadReady

A launch-integration readiness workspace for small satellite, CubeSat, and hosted-payload teams. PayloadReady
tracks what's required for the next launch-integration milestone, what's complete, what evidence supports it,
what's missing or blocked, who owns it, and what threatens the schedule.

> PayloadReady is a coordination and readiness-tracking tool. It does not certify flightworthiness, safety,
> regulatory compliance, or launch approval. Final determinations remain with qualified mission personnel,
> regulatory authorities, launch providers, and integrators.

## Requirements

- **Node.js 18.18+** (built and tested on Node 22) and npm.

This is a real Next.js application, not a static file — it needs Node installed locally to run `npm install`
and `npm run dev`. If Node isn't available on your machine, see **No-local-Node options** below.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the sign-in screen — click
**"Explore the Pathfinder-1 demo mission"** to open a fully populated fictional mission with no account needed,
or fill in any email/password to "sign in" (this MVP simulates auth locally; nothing is sent anywhere).

## No-local-Node options

If you can't install Node.js on this machine:

- **Vercel from GitHub (no local Node needed):** push this folder to a new GitHub repository, then import it at
  [vercel.com/new](https://vercel.com/new). Vercel builds and hosts it for you — no local install required.
- **StackBlitz / CodeSandbox:** drag this folder into [stackblitz.com](https://stackblitz.com) (WebContainers
  run Node.js in the browser) to get a live editable preview without installing anything locally.
- **GitHub Codespaces:** open the repo in a Codespace, which gives you a cloud dev environment with Node
  preinstalled.

## What's built

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4** — light engineering-workspace visual system
  (white/light-gray surfaces, deep navy primary, muted blue accents, green/amber/red status colors).
- **Local, seeded data layer** (`src/lib/store.ts`, a Zustand store persisted to `localStorage`) standing in
  for Supabase — no external services or paid APIs required to run the full app. `schema/schema.sql` has the
  full relational schema, indexes, and row-level-security policies ready for when you want to activate a real
  Supabase backend; the store's action shapes already mirror those tables.
- **Every screen from the brief:** sign-in, onboarding (organization → mission → template), Dashboard, Missions
  list + mission workspace, Readiness Checklist (grouped and table views, filters, detail drawer), Evidence
  library (submit / accept / reject / resubmit with revision tracking), Issues (state-grouped board), Decisions
  (approve/reject with rationale), a dedicated Readiness Decision screen (score, warnings, conditions/reasons,
  audit history of past decisions), printable Reports, and Settings (org, mission, users & roles, checklist
  templates, notifications, audit log).
- **Transparent, tested readiness scoring** (`src/lib/readiness.ts`) — priority-weighted checklist completion,
  with configurable status weights and explicit warnings (blocked critical items, rejected evidence, unresolved
  critical issues, an integration deadline inside 30 days, pending decisions blocking dependent work). 13 unit
  tests cover the calculation and warning logic (`npx vitest run`).
- **Demo mission:** Meridian Orbital Systems / Pathfinder-1 (fictional), a 12U CubeSat tech demo, seeded with
  42 checklist items across all ten categories (25 accepted / 8 in progress / 4 under review / 3 blocked /
  2 not started), evidence records, 3 issues, 2 pending decisions, and 5 overdue actions — including the six
  specific problems called out in the brief (vibration-test report awaiting review, overdue mass-properties
  document, an illustrative FCC-style filing marked pending, rejected battery-safety evidence, a pending
  deployment-switch decision, and a schedule-threatening late external test artifact).

## Project structure

```
src/
  app/
    sign-in/                  Sign-in + demo entry
    onboarding/                Organization -> mission -> template wizard
    (app)/                     Authenticated shell (sidebar + header)
      dashboard/ missions/ checklist/ evidence/ issues/ decisions/ readiness/ reports/ settings/
  components/
    ui/                        Primitives: Button, Card, Badge, Dialog, Drawer, Tabs, Toast, ...
    layout/                     Sidebar, Header
    shared/                     PageHeader, StatCard, FilterBar, status-meta (status -> label/color)
    checklist/                  Checklist detail drawer, create-item dialog
  lib/
    types.ts                    Domain model (mirrors schema/schema.sql)
    seed.ts                     Fictional Pathfinder-1 demo data
    store.ts                    Zustand data-access layer (local, persisted) + all mutations
    readiness.ts                Readiness score + warnings (unit tested)
    utils.ts                    Formatting helpers
    __tests__/                  Vitest unit tests
schema/
  schema.sql                    Full Supabase/PostgreSQL schema, indexes, and RLS policies
```

## Testing

```bash
npx vitest run      # 13 unit tests covering readiness scoring and warning logic
npx tsc --noEmit     # type check
npx eslint .          # lint
npm run build          # production build
```

All four currently pass clean.

## Test / demo access

No real credentials exist — this MVP simulates authentication locally. Use the **demo button** on the sign-in
screen, or type any email/password into the sign-in form (it accepts anything, since there is no backend to
validate against).

## Known MVP limitations

1. **No real backend yet.** Data lives in `localStorage` via Zustand; it's per-browser and not shared across
   devices or users. `schema/schema.sql` is ready to activate a real Supabase project when you want persistence
   and multi-user collaboration.
2. **File upload is simulated.** Evidence "uploads" attach file metadata (a name, a fake path) rather than
   real files — there's no Supabase Storage wired up yet.
3. **Role permissions are modeled but not enforced.** Roles and their descriptions appear in Settings and
   the RLS policies define the org-level data boundary, but the UI doesn't yet hide or disable actions based on
   the signed-in user's role (e.g. an "Executive" can currently still edit records in this build).
4. **Report snapshot history isn't persisted.** The Reports screen always renders the live current state;
   there's no saved history of previously generated report snapshots yet (the `report_snapshots` table in the
   schema is ready for this).
5. **Single organization per browser session.** The onboarding flow can create additional missions, but there's
   no organization-switcher UI for belonging to multiple organizations.

## Five highest-value next improvements

1. **Wire up Supabase** using `schema/schema.sql` for real persistence, multi-user collaboration, and RLS-backed
   organization isolation — swap the Zustand store's local mutations for Supabase client calls (the shapes
   already match).
2. **Enforce role-based permissions in the UI**, not just descriptively in Settings — disable/hide destructive
   or approval actions for roles that shouldn't have them (e.g. Executive is read-only).
3. **Real file storage** for evidence uploads via Supabase Storage, with signed URLs and file previews.
4. **Persisted report snapshots** so leadership can compare readiness over time, plus a scheduled weekly digest
   email (the notification preference already exists in Settings as a UI stub).
5. **Dependency-aware checklist logic** — surface a warning when an item is marked "accepted" while an upstream
   dependency it lists is still open, and auto-suggest evidence links based on requirement source matches.
