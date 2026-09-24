# Plano

**Plan your perfect day. Reach every goal.**

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
| **AI Assistant** ⭐ | Chat + **"Generate my perfect schedule"**, **"Fix my week"** rescheduling, motivational coaching, and a data-driven weekly review. |
| **Storage** | localStorage today, behind a clean adapter (`src/lib/db.js`) so Supabase/Firebase plugs in later. |

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
- **Backend:** Node.js + Express (protects your LLM API key — it never ships to the browser)
- **Storage:** localStorage via a swappable DB adapter (`src/lib/db.js`)
- **AI:** Anthropic Claude or OpenAI, selected via `LLM_PROVIDER`

```
plano/
├─ .github/workflows/deploy.yml   GitHub Actions: build + GitHub Pages deploy
├─ index.html                     SPA entry
├─ package.json
├─ vite.config.js                 dev proxy /api → :3001, relative base
├─ tailwind.config.js             design tokens (dark mode = .dark class)
├─ server/
│  ├─ index.js                    Express app, static build serving
│  ├─ llm.js                      provider abstraction + JSON extraction
│  ├─ planner.js                  local scheduling engine + LLM validator
│  ├─ prompts.js                  the AI system prompts
│  └─ routes/ai.js                /api/ai/* endpoints w/ offline fallbacks
└─ src/
   ├─ main.jsx, App.jsx, index.css
   ├─ lib/         db, api, stats, date utils, eisenhower, plannerInput
   ├─ context/     AppContext (state, CRUD, theme, persistence)
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

---

## ☁️ Deployment

Because the AI key is **server-side**, a fully-featured deployment needs a host that runs Node (Heroku, Railway, Render, Fly.io, a VPS — or Vercel's Node functions). Add your env vars there; the same `npm run build && npm start` works everywhere.

For a **static-only** demo (frontend without AI), deploy `dist/` (built with a relative base) to GitHub Pages, Netlify, or Vercel:

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

- Cloud sync via Supabase (swap `src/lib/db.js`)
- Recurring task auto-completion & reminders (Service Worker + push)
- Calendar integrations (Google/Apple ICS export, CalDAV)
- Multi-goal "project" views with Gantt-style planning
- Natural-language task input ("call dentist tomorrow 10am")

---

## 📄 License

MIT — see [LICENSE](LICENSE).