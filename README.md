# TSG — Two Side Gamers · Esports Organization Platform

A full-stack esports organization website for **Two Side Gamers (TSG)** with two
independent competitive teams — **TSG ARMY** (Male) and **TSG ARTEMIS** (Female) —
a live tournament/match system, dynamic player statistics, community comments,
and a complete Admin CMS. **All content is managed from the Admin Panel — no code edits needed.**

## Feature Overview

### Public website
- Cinematic home page with a real-time 3D hero (Three.js / React Three Fiber): particles, rotating emblem, red/blue lighting, mouse-follow camera, lazy-loaded and reduced-motion aware
- Teams — separate data per team: rosters, tournaments, results
- Players — premium 3D tilt cards, profiles with **statistics computed live from match-performance data** (matches played, kills, averages, points, best placement, best match)
- Tournaments — any number of matches per event, 5-player performance cards, per-tournament player totals, special moments, final point-table viewer (zoom / pan / fullscreen / download)
- Schedule — upcoming / live / completed, filterable by team
- Live page — auto-refreshing "LIVE NOW" dashboard with watch links
- Community — sign-in to comment, reply, react, edit/delete your own comments; per-tournament discussions
- Global search (players, teams, tournaments), About / Contact / Privacy / Terms

### Admin CMS (`/admin`)
Dashboard with live counts · Teams · Players · Tournaments · Matches & performance entry (mobile-optimized, sticky save, numeric inputs) · Point-table image upload · Owners & TSG Legend · Schedule · Live control room (go live, live links, end tournament) · Comment moderation (pin / hide / delete) · User management (ban) · Media library (upload / categorize / search / delete) · Organization settings & social links.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| 3D | Three.js, React Three Fiber, Drei |
| Backend | Hono + tRPC 11 (end-to-end type-safe), Zod validation |
| Database | MySQL via Drizzle ORM |
| Auth | Google / Discord OAuth (JWT sessions), roles: `fan` / `player` / `moderator` / `admin` |
| Storage | Platform object storage (images), keys stored in DB, short-lived signed URLs at render time |

## Data Model (db/schema.ts)

`users` · `org_settings` · `people` (owners + legend) · `teams` · `players` ·
`tournaments` · `matches` · `match_performances` · `media` · `comments` · `comment_reactions`

Teams are fully isolated: players, tournaments, matches and comments all hang off a
single `teamId`. Slugs are unique and auto-generated.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server with HMR on :3000
npm run check      # TypeScript type-check
npm run build      # production build (client + server)
npm start          # run production server
npm run lint       # ESLint
npm run db:push    # sync schema to the database
npx tsx db/seed.ts # seed demo content (safe to re-run; skips if teams exist)
```

## Environment

`.env` is provisioned automatically by the platform (database URL, OAuth app id/secret,
gateway credentials, storage resource id). Never commit it; `.env.example` lists the keys.

## Roles & Access Control

Four roles, enforced **server-side** in tRPC middleware against the role stored in
the database (never trusting the client):

| Role | Can access |
|---|---|
| `fan` (default) | Sign in, comment, reply, react, edit/delete own comments |
| `player` | Everything a fan can (identity/badge tier for roster members) |
| `moderator` | Everything a fan can, **plus** comment moderation (pin / hide / delete any comment) via `/admin/comments` |
| `admin` | Everything, including the full Admin CMS and role assignment |

- The first user who signs in with the owner Google or Discord account (`OWNER_GOOGLE_EMAIL` / `OWNER_DISCORD_ID`)
  is automatically granted `admin`; every other new account starts as `fan`.
- Admins assign roles from **Admin → Users**. Guard rails: you cannot change your own
  role, and the last remaining admin can never be demoted.
- Guards live in `api/middleware.ts`: `authedQuery` (any role), `moderatorQuery`
  (moderator+), `adminQuery` (admin only), with hierarchy helpers
  (`hasAtLeastRole`, `hasRole`) in `contracts/constants.ts`.
- Banned users are blocked from commenting, reacting, and editing comments.

**Upgrading an existing database** from the old `user`/`admin` enum: run the three
statements in `db/migrations/role-upgrade.sql` in order (a plain `db:push` would
corrupt rows still containing `user`). Fresh databases just use `npm run db:push`.

## Demo Content

The seed creates clearly-marked demo data (2 teams, 10 players, 4 tournaments,
6 matches with performances, both owners and the TSG Legend). Every record is
editable or deletable from the Admin Panel, and player statistics update
automatically as match performances change.

## Notes

- Image uploads go through the server to platform object storage (8 MB cap, image
  MIME whitelist, synchronous content review). The database stores only storage keys.
- Comment spam protection: per-user rate limit (8s), server-side sanitization, ban support.
- Billing: a published site consumes the owner's quota (server runtime + storage).
