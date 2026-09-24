# Plano

**Plan your perfect day. Reach every goal.**

> 🚀 **Try the live demo:** [**plano.1br4h1mX.github.io**](https://1br4h1mX.github.io/plano/) — no sign-up, works in your browser.
>
> <p>
> <img alt="Live demo" src="https://img.shields.io/badge/Live%20demo-1br4h1mX.github.io%2Fplano-6366f1?style=for-the-badge&logo=githubpages&logoColor=white&labelColor=111" />
> </p>

Plano is a production-quality time-management and productivity web app with a built-in **AI Planning Assistant**. It turns your goals, tasks, deadlines, working hours and energy profile into a balanced, realistic schedule — generated with one click and addable to your calendar with another.

Inspired by the calm of Notion, the clarity of Todoist and the rhythm of Google Calendar. Fully responsive, WCAG-friendly, dark/light mode, and ready to grow from localStorage to a real database.

---

## ✨ Features

| Area | What you get |
| --- | --- |
| **Dashboard** | Today's schedule, upcoming deadlines, goal progress, and a productivity pulse. |
| **Task manager** | Create / edit / delete / complete tasks with Eisenhower priorities, deadlines, durations, categories and recurring options. |
| **Calendar** | Day, week and month views with **drag-and-drop scheduling**. Drag tasks onto the grid, or drag blocks to reschedule. |
| **Goals** | Set goals ("Learn Spanish in 3 months"), split them into milestones, track progress with progress bars. |
| **Focus timer** | Pomodoro timer with configurable work/break lengths and break reminders (sounds + browser notifications). |
| **Statistics** | Bar/area/pie charts of completed tasks, focus minutes, categories + day streaks. |
| **Settings** | Dark/light/system theme, working hours, work days, energy profile, notifications, fixed commitments. |
| **Accounts** | Sign up / log in with the built-in backend (scrypt-hashed passwords, session tokens) — your tasks, goals and settings sync across devices. |
| **AI Assistant** ⭐ | Chat + **"Generate my perfect schedule"**, **"Fix my week"** rescheduling, motivational coaching, and a data-driven weekly review. |
| **Storage** | `localStorage` by default; signed-in accounts sync to the backend behind one adapter (`src/lib/db.js`). |

### The AI Helper (special feature)

- Chat-style assistant with your live context (open tasks, goals, working hours, energy, recent focus stats).
- **Structured JSON contract** — the LLM returns a schedule schema that the app validates (`server/planner.js#validateSchedule`) and renders automatically.
- Well-crafted system prompts in `server/prompts.js`:
  - Eisenhower triage (urgent × important)
  - fixed commitments protected first
  - breaks + buffer + lunch built in, never more than ~6–7h focus/day
  - big goals broken into daily 25-minute steps
- **Works offline too**: if no API key is configured (or the provider is down), the built-in scheduling engine produces a great plan, so the product never breaks.
- "I missed today, fix my week" rebuilds the plan from the missed day.
- Weekly review endpoint summarizes completion, focus hours and streaks with next-week suggestions.

---

## 🧱 Tech stack

- **Frontend:** React 18 + Vite 5 + Tailwind CSS 3 + React Router + Recharts + date-fns
- **Backend:** Node.js + Express (self-host) **or** Cloudflare Pages Functions + D1 (recommended for a public demo — free, no cold starts)
- **Storage:** localStorage (offline) + accounts on either the Express JSON store or Cloudflare D1, behind one adapter (`src/lib/db.js`)
- **AI:** Anthropic Claude or OpenAI, selected via `LLM_PROVIDER` (or bring-your-own key in Settings)

```
plano/
├─ .github/workflows/deploy.yml   GitHub Actions: build + GitHub Pages deploy
├─ .github/workflows/deploy-cloudflare.yml  build + D1 migrate + Pages deploy
├─ wrangler.toml                  Cloudflare Pages + D1 config
├─ migrations/                    0001_init.sql (users/sessions/data tables)
├─ functions/
│  ├─ api/[[path]].js             the account API on Pages Functions
│  └─ lib/store-d1.js             D1 store (scrypt hashing, session tokens)
├─ index.html                     SPA entry
├─ package.json
├─ vite.config.js                 dev proxy /api → :3001, relative base
├─ tailwind.config.js             design tokens (dark mode = .dark class)
├─ server/
│  ├─ index.js                    Express app, static build serving
│  ├─ llm.js                      provider abstraction + JSON extraction
│  ├─ planner.js                  local scheduling engine + LLM validator
│  ├─ prompts.js                  the AI system prompts
│  ├─ lib/store.js                scrypt-hashed users, sessions, account data
│  └─ routes/                     ai.js, auth.js (signup/login/me), data.js
└─ src/
   ├─ main.jsx, App.jsx, index.css
   ├─ lib/         db, remote, ai, stats, date utils, eisenhower, plannerInput
   ├─ context/     AppContext (state, CRUD, theme, persistence, account)
   ├─ hooks/       useApp, useLocalStorage, useNow
   ├─ components/  ui, layout, tasks, calendar, ai, timer, stats
   └─ pages/       Landing, Dashboard, Tasks, Calendar, Goals, FocusTimer,
                   Statistics, AIHelper, Settings, AppShell
```

---

## 🚀 Getting started

### Prerequisites
- **Node.js 18+** (20 LTS recommended)

### 1. Install
```bash
cd plano
npm install
```

### 2. (Optional) Configure the AI
```bash
cp .env.example .env
# edit .env — or leave the keys empty to use the built-in planner
```
Get a key from [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com/api-keys).

### 3. Run in development
```bash
npm run dev
```
- Frontend: http://localhost:5173
- API server: http://localhost:3001

`npm run dev` starts both concurrently. The Vite dev server proxies `/api` → the Express server, so the AI key never leaves the server.

### 4. Production build + run
```bash
npm run build   # outputs dist/
npm start       # Express serves the API AND the built app
```
Open http://localhost:3001.

### 5. Accounts
The Express server stores accounts under `server/data/` (gitignored). Sign up in **Settings → Account** and your data syncs across devices signed into the same account. On a static-only host (GitHub Pages demo) the account form shows a "backend unreachable" message and Plano keeps working in the browser alone.

---

## ⚡ Cloudflare deployment (recommended: accounts for everyone)

One free Cloudflare Pages project serves **both** the app and the API (Pages Functions + D1), so friends can sign up at your live URL — no local PC, no other host. There is no cold-start delay (unlike Render's free tier).

**One-time setup (in the repo, with wrangler installed):**
```bash
npm install                # includes wrangler (dev dependency)
npx wrangler login         # opens a browser to authorize your Cloudflare account
npx wrangler d1 create plano-app    # note the returned database_id
# paste that id into wrangler.toml → [[d1_databases]] → database_id
npx wrangler d1 migrations apply plano-app
npx wrangler deploy        # Creates plano-app.pages.dev and uploads SPA + functions
```
(Or run the whole thing in one step after login: `npm run cf:setup` — it creates the D1 database, pins the id in `wrangler.toml`, applies migrations and deploys.)
Your demo is now `https://plano-app.pages.dev` — sign up in **Settings → Account** and share the link.

**Local development against the Cloudflare stack:**
```bash
npm run build
npx wrangler d1 migrations apply plano-app --local   # seeds .wrangler/state D1
npx wrangler pages dev dist --port 8788          # SPA + functions on :8788
```

**Automatic deploys from GitHub:** add two repo secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and `.github/workflows/deploy-cloudflare.yml` builds, runs D1 migrations and deploys on every push to `main`. The old GitHub Pages workflow still runs too — it now points its `/api` calls at `https://plano-app.pages.dev`, so the `github.io` link works as well.

The Express server in `server/` remains fully supported (`npm run build && npm start`) for self-hosting on a VPS where you control the data directly.

---

## 🔐 Environment variables

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `auto` · `anthropic` · `openai` |
| `ANTHROPIC_API_KEY` | Claude API key (server-side only) |
| `ANTHROPIC_MODEL` | default `claude-3-5-sonnet-latest` |
| `OPENAI_API_KEY` | OpenAI key (server-side only) |
| `OPENAI_MODEL` | default `gpt-4o-mini` |
| `PORT` | Express port (default `3001`) |
| `PLANO_DATA_DIR` | where account data is stored (default `server/data/`) |

---

## ☁️ Deployment

Given the AI key and **accounts are server-side**, a fully-featured deployment needs a host that runs Node (Heroku, Railway, Render, Fly.io, a VPS — or Vercel's Node functions). Add your env vars there; the same `npm run build && npm start` works everywhere. Account data lives in the configured `PLANO_DATA_DIR` (persist it with a mounted volume on free-tier hosts).

For a **static-only** demo (frontend without AI or accounts), deploy `dist/` (built with a relative base) to GitHub Pages, Netlify, or Vercel:

**GitHub Pages** — enable Pages → "GitHub Actions" in repo settings. The included workflow `.github/workflows/deploy.yml` builds and deploys on every push to `main`. (Hash-based routing means no rewrite rules are needed.)

**Netlify**
```bash
npm run build
# Publish directory: dist   ·   Build command: npm run build
```

**Vercel**
```bash
vercel          # Framework: Vite → output dist
```

---

## 🖼️ Screenshots

> Add screenshots of the Dashboard, the AI Assistant schedule, Calendar week view and Statistics here.
> *(Screenshots placeholder — see the live app after `npm run dev`.)*

---

## 🧭 Usage guide

1. **Land**: Dashboard greets you with seeded sample tasks/goals — edit or delete freely.
2. **Dump tasks** (`Tasks`): add everything on your plate with priorities, deadlines and durations.
3. **Set goals** (`Goals`): create a goal, add milestones.
4. **Generate** (`AI Assistant`): hit **Generate my perfect schedule**, review the balanced week, then **Add to calendar**.
5. **Execute** (`Calendar` + `Focus timer`): drag tasks to reschedule, run Pomodoros, log focus time.
6. **Review** (`Statistics` + `AI Assistant` → **Weekly review**): see what worked, adjust what didn't.
7. **Customize** (`Settings`): working hours, energy profile, commitments, theme, notifications.

### Keyboard
- `Space` starts/pauses the focus timer (when not typing in an input).
- `Esc` closes dialogs.

---

## 🤝 Contributing

1. Fork & clone the repo.
2. `npm install`, then `npm run dev`.
3. Create a feature branch: `git checkout -b feat/your-idea`.
4. Make changes — follow existing patterns; keep components in `src/components/`, pages in `src/pages/`, pure logic in `src/lib/`.
5. Verify: `npm run build` must succeed. Add tests for new pure logic if practical (`npm test`, once a runner is added).
6. Commit with a concise message, push, open a PR.

Please keep the storage layer swapped behind `src/lib/db.js` and never add an AI key to the client bundle.

---

## 🗺️ Roadmap suggestions

- Session persistence, password reset emails, and rate limiting on auth
- Recurring task auto-completion & reminders (Service Worker + push)
- Calendar integrations (Google/Apple ICS export, CalDAV)
- Multi-goal "project" views with Gantt-style planning
- Natural-language task input ("call dentist tomorrow 10am")

---

## 📄 License

MIT — see [LICENSE](LICENSE).