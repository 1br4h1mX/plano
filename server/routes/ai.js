import { Router } from 'express';
import { complete, extractJson, config } from '../llm.js';
import { buildPlan, validateSchedule } from '../planner.js';
import { SCHEDULE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, REVIEW_SYSTEM_PROMPT } from '../prompts.js';
import { OPS_SYSTEM_PROMPT, scheduleSnapshot, normalizeOps } from '../../src/lib/opsProtocol.js';

const router = Router();

const summarizeInput = (input) => {
  const t = (input.tasks || []).map(
    (x) => `- [priority ${x.priority}/4] "${x.title}" (${x.durationMinutes || 30} min${x.deadline ? `, due ${x.deadline}` : ''})${x.category ? ` [${x.category}]` : ''}`,
  ).join('\n');
  const g = (input.goals || []).map(
    (x) => `- goal "${x.title}"${x.targetDate ? ` (target ${x.targetDate})` : ''}`,
  ).join('\n');
  return `WORKING HOURS: ${input.workingHours?.start}–${input.workingHours?.end}, work days: [${(input.workDays || []).join(',')}]\nENERGY PROFILE: ${input.energy || 'balanced'}\n\nTASKS:\n${t || '- none'}\n\nGOALS:\n${g || '- none'}`;
};

const promptForBuild = (input, mode) =>
  `${mode === 'reschedule' ? 'RESCHEDULE MODE' : 'BUILD MODE'}: produce a fresh ${input.days || 7}-day schedule starting ${input.missedDate || input.startDate || 'today'}.${mode === 'reschedule' ? ' The user feels their plan fell apart recently; rebuild it cleanly from the missed date onward rather than pretending the past is fixable.' : ''}\n\n${summarizeInput(input)}` +
  `\n\nAlso honor these fixed commitments:\n${(input.commitments || []).map((c) => `- "${c.title}" ${c.days?.length ? `on weekdays [${c.days.join(',')}]` : 'daily'} ${c.start}–${c.end}`).join('\n') || '- none'}`;

router.get('/health', (_req, res) => {
  res.json({ aiConfigured: Boolean(config()) });
});

// Generate (or re-generate) the perfect schedule.
router.post('/schedule', async (req, res, next) => {
  try {
    const input = req.body?.input || {};
    const fallback = buildPlan(input);
    const cfg = config();

    if (!cfg) {
      return res.json({ source: 'local', plan: fallback, warnings: ['No LLM configured — using the built-in smart planner. Add an API key to server/.env for the full AI experience.'] });
    }

    const user = promptForBuild(input, input.missedDate ? 'reschedule' : 'build');
    const raw = await complete({ system: SCHEDULE_SYSTEM_PROMPT, user });
    const { plan, warnings } = validateSchedule(extractJson(raw));
    res.json({ source: 'llm', plan, warnings, raw });
  } catch (err) {
    if (err.status === 503 || err.status === 500) {
      // Graceful degradation: LLM failed -> use the local engine so the app still works.
      const plan = buildPlan(req.body?.input || {});
      return res.json({ source: 'local', plan, warnings: [`AI request failed (${err.message}). Using the built-in planner instead.`] });
    }
    next(err);
  }
});

// "I missed today, fix my week"
router.post('/reschedule', (req, res) => {
  const { missedDate, input } = req.body || {};
  const merged = { ...(input || {}), missedDate: missedDate || input?.missedDate };
  res.json({ source: 'local', plan: buildPlan(merged), warnings: [] });
});

// Chat assistant.
router.post('/chat', async (req, res, next) => {
  try {
    const { messages, context } = req.body || {};
    const contextText = (context || []).map((c) => `- ${c}`).join('\n');
    const cfg = config();

    if (!cfg) {
      return res.json({ reply: localChatReply(messages?.at?.(-1)?.content || '') });
    }

    const history = (messages || [])
      .filter((m) => m && m.role && m.content)
      .slice(-12)
      .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
      .join('\n');

    const user = `LIVE USER CONTEXT:\n${contextText || '- none'}\n\nCONVERSATION SO FAR:\n${history}`;
    const reply = await complete({ system: CHAT_SYSTEM_PROMPT, user, maxTokens: 800 });
    res.json({ reply: reply.trim() });
  } catch (err) {
    if (err.status === 503 || err.status === 500) {
      return res.json({ reply: 'I could not reach the AI provider right now — but here is a tip: protect one 90-minute block tomorrow for your single most important task. That alone will move your whole week forward.' });
    }
    next(err);
  }
});

// Turn a natural-language request into validated schedule operations.
// The server only talks to the LLM and returns { text, ops }; the client's
// deterministic operation layer still decides conflicts, slots and apply.
router.post('/ops', async (req, res, next) => {
  try {
    const { query, tasks, settings } = req.body || {};
    const cfg = config();
    if (!cfg) return res.status(503).json({ error: 'No LLM configured on the server.' });

    const user = `SCHEDULE SNAPSHOT:\n${scheduleSnapshot({ tasks, settings })}\n\nUSER REQUEST: ${query || ''}`;
    const raw = await complete({ system: OPS_SYSTEM_PROMPT, user, maxTokens: 1200 });
    const parsed = extractJson(raw);
    res.json({
      text: typeof parsed?.text === 'string' ? parsed.text : '',
      ops: normalizeOps(parsed?.ops),
    });
  } catch (err) {
    if (err.status === 503 || err.status === 500) return res.status(503).json({ error: err.message });
    next(err);
  }
});

// Weekly review.
router.post('/review', async (req, res, next) => {
  try {
    const { stats } = req.body || {};
    const sum = {
      completedTasks: stats?.completedTasks ?? 0,
      focusMinutes: stats?.focusMinutes ?? 0,
      streaks: stats?.streaks ?? { current: 0, best: 0 },
      daysActive: stats?.daysActive ?? 0,
    };
    const cfg = config();
    if (!cfg) {
      return res.json({ review: localReview(sum) });
    }
    const user =
      `THIS WEEK'S STATS: completed ${sum.completedTasks} task(s), ${Math.round(sum.focusMinutes / 60)}h ${sum.focusMinutes % 60}m of focus, ${sum.daysActive} active day(s), current streak ${sum.streaks.current} (best ${sum.streaks.best}).`;
    const review = await complete({ system: REVIEW_SYSTEM_PROMPT, user, maxTokens: 900 });
    res.json({ review: review.trim(), stats: sum });
  } catch (err) {
    if (err.status === 503 || err.status === 500) res.json({ review: localReview(sum), stats: sum });
    else next(err);
  }
});

export default router;

/* ---------- offline fallbacks (no API key required) ---------- */

function localChatReply(q) {
  const text = (q || '').toLowerCase();
  if (/overwhelm|stress|too much|burnout|exhausted/.test(text)) {
    return 'That feeling is your to-do list trying to be a week planner. Here is the fix: pick only 3 must-dos for tomorrow, schedule them in ~1.5h blocks with real breaks, and delete everything else for now. Want me to build that tomorrow for you?';
  }
  if (/missed|fell behind|off track|forgot|skip/.test(text)) {
    return 'No one streaks forever — the trick is never missing twice. Give me your tasks and I will rebuild your week from today, dropping whatever is actually optional. Press "Generate my perfect schedule" and tell me you had a hard day.';
  }
  if (/morning|evening|energy|when.*work|best time/.test(text)) {
    return 'Match your biology, not the clock: deep work at your energy peak (morning: before 11am, evening: after 3pm), admin/batch work in the dip, and your toughest meeting right after a short walk. Set your energy profile in Settings and I will honor it in every schedule.';
  }
  if (/motivat|procrastinat|unmotivated|lazy/.test(text)) {
    return 'Motivation follows action, not the other way around. Commit to 5 minutes of your biggest task right now — just 5. By minute 3 the momentum is usually there to keep going. What is that task?';
  }
  if (/goal|habit|spanish|fitness|read|learn/.test(text)) {
    return 'Goals collapse when they are not on the calendar. Break yours down to a daily 25-minute "Goal focus" block — same time every day — and let me add it to your schedule automatically. Which goal do you want to protect first?';
  }
  if (/break|rest|pomodoro/.test(text)) {
    return 'Rest is a productivity tool, not a reward. The 25/5 Pomodoro rhythm + a real lunch break keeps your focus sharp all day, so my schedules always include them. Start the Focus Timer in the sidebar when you begin.';
  }
  if (/thank|great|awesome|love|nice/.test(text)) {
    return 'Anytime! Build your next perfect day and let me know how it goes.';
  }
  return 'I am your planning assistant. I can: 1) build your perfect schedule, 2) fix your week when plans change, 3) break goals into daily steps, and 4) look over your week and suggest improvements. What do you need?';
}

function localReview(s) {
  const hours = Math.round(s.focusMinutes / 60);
  const hoursLabel = s.focusMinutes ? `${hours}h ${s.focusMinutes % 60}m` : 'no logged focus';
  const head = `## Your week at a glance\n\n- **Tasks completed:** ${s.completedTasks}\n- **Focus time:** ${hoursLabel}\n- **Active days:** ${s.daysActive}\n- **Current streak:** ${s.streaks.current} days (best ${s.streaks.best})\n`;
  const wins = s.completedTasks >= 10
    ? '## Wins to celebrate\n\nStrong finishing week — completing more than one or two tasks per active day compounds fast.'
    : s.completedTasks >= 5
      ? '## Wins to celebrate\n\nSolid week of momentum. Every completed task is proof the system works when you show up.'
      : '## Wins to celebrate\n\nLook past the number: the real win is any task that had been sitting for weeks — you moved it.';
  const body = '## What held you back\n\n- Over-scheduling small tasks instead of protecting one deep-work block per day.\n- Missing breaks — schedule them like meetings; they protect your focus.\n\n## Next week\n\n1. Protect **one 90-minute deep block** per day, same time, for your #1 priority.\n2. Batch low-priority tasks into a single 30-minute "admin" slot.\n3. **Tonight**: decide tomorrow\'s 3 must-dos and let the assistant build the day.\n\nKeep going — tension is progress building.';
  return `${head}\n\n${wins}\n\n${body}`;
}