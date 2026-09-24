/**
 * offlineAI.js — the built-in assistant that runs entirely in the browser.
 *
 * Mirrors server/routes/ai.js local() fallbacks so the AI assistant, weekly
 * review and scheduling work on static hosts (e.g. GitHub Pages) with no
 * backend and no API key. The chat replies are context-aware: they read the
 * live { tasks, goals, settings, stats } snapshot (contextLines) and give
 * concrete, personalized guidance instead of generic canned text.
 */

/** Extract useful facts from the contextLines() snapshot. */
function readContext(lines = []) {
  const fact = { pendingCount: 0, pending: [], goals: [], hasStats: false };
  for (const line of lines) {
    if (line.startsWith('Pending tasks:')) {
      const raw = line.slice('Pending tasks: '.length);
      fact.pending = raw
        .split(', ')
        .filter((x) => x && !x.startsWith('…'))
        .map((x) => {
          const m = x.match(/^"(.+?)" \(p?(\d+)\)$/);
          return m ? { title: m[1], priority: Number(m[2]) } : { title: x.replace(/^"|"$/g, ''), priority: 2 };
        });
      fact.pendingCount = /…$/.test(raw) ? Infinity : fact.pending.length;
    } else if (line.startsWith('Goals:')) {
      fact.goals = line.slice('Goals: '.length)
        .split(', ')
        .filter(Boolean)
        .map((g) => g.replace(/^"|"$/g, ''));
    } else if (line.startsWith('Working hours')) {
      fact.absorption = true;
    }
  }
  return fact;
}

function topTasks(fact, n = 3) {
  return fact.pending
    .filter((t) => t.priority === 1)
    .slice(0, n)
    .map((t) => t.title);
}

export function localChatReply(question, contextLines = []) {
  const text = (question || '').toLowerCase();
  const fact = readContext(contextLines);
  const p1 = topTasks(fact);
  const pendingLabel =
    fact.pendingCount > 0
      ? p1.length
        ? `your ${p1.length} high-priority task(s) (${p1.join(', ')})`
        : `${fact.pendingCount === Infinity ? 'your' : 'your ' + fact.pendingCount} pending task(s)`
      : 'your tasks';

  if (/overwhelm|stress|too much|burnout|exhausted|anxious/.test(text)) {
    return `That feeling is your to-do list trying to be a week planner. Here is the fix: pick only 3 must-dos for tomorrow, schedule ${pendingLabel} in ~1.5h blocks with real breaks, and delete everything else for now. Want me to build a 7-day plan out of it? Hit "Generate my schedule" and I'll balance the week for you.`;
  }
  if (/missed|fell behind|off track|fell off|forgot|skip|reset|start over/.test(text)) {
    return `No one streaks forever — the trick is never missing twice. I can rebuild your week from today, dropping whatever is actually optional. Press "Fix my week", pick the day it fell apart, and I'll rebalance ${pendingLabel} from there.`;
  }
  if (/morning|evening|night owl|energy|best time|when (should|to|do)/.test(text)) {
    return `Match your biology, not the clock: deep work at your energy peak (morning: before 11am, evening: after 3pm), admin and batch work in the dip, and your toughest meeting right after a short walk. Set your energy profile in Settings and I'll honor it in every schedule.`;
  }
  if (/motivat|procrastinat|unmotivated|lazy|stuck|start/.test(text)) {
    return `Motivation follows action, not the other way around. Commit to 5 minutes of your biggest task right now — just 5. By minute 3 the momentum is usually there to keep going.${
      p1.length ? ` "Start with ${p1[0]}."` : ''
    } What is that task?`;
  }
  if (/goal|habit|spanish|fitness|reading|learn|study|practice/.test(text)) {
    const goalName = fact.goals[0];
    const target = goalName ? ` "${goalName}"` : '';
    return `Goals collapse when they are not on the calendar. Break${target || ' yours'} down to a daily 25-minute "Goal focus" block — same time every day — and let me add it to your schedule automatically. Which goal do you want to protect first?`;
  }
  if (/break|rest|pomodoro|sleep|tired|focus/.test(text)) {
    return `Rest is a productivity tool, not a reward. The 25/5 Pomodoro rhythm plus a real lunch break keeps your focus sharp all day, so my schedules always include them. Start the Focus Timer in the sidebar when you begin, and you'll see it in your stats within the day.`;
  }
  if (/(plan|schedule|organi[sz]e|arrange).*(my|the).*(day|week)|generate|perfect schedule|plan my week/.test(text)) {
    return `Say less — press "Generate my schedule" and I'll turn ${pendingLabel} into a balanced 7-day plan with breaks, buffers and daily goal steps, ready to drop on the calendar in one click.`;
  }
  if (/review|week|look back|progress|how.*doing|improve/.test(text)) {
    return `You can judge the data right now: press "Weekly review" above and I'll turn your stats into wins, roadblocks, and next-week moves.${pendingLabel ? ` For a start, keep ${pendingLabel} visible and committed.` : ''}`;
  }
  if (/thank|great|awesome|love|nice|perfect|helpful/.test(text)) {
    return `Anytime! Build your next perfect day and let me know how it went.`;
  }
  if (/hi|hello|hey|yo|sup/.test(text)) {
    return `Hey! I'm Plano, your planning copilot. I can build you a perfect schedule, fix your week when plans change, turn goals into daily steps, and review how you're doing.${fact.pendingCount > 0 ? ` I see ${pendingLabel} waiting — want me to plan them first?` : ' What do you need today?'}`;
  }
  if (fact.pendingCount > 0) {
    return `I can help with that. Right now you have ${pendingLabel} to schedule — press "Generate my schedule" and I'll protect time for them. Or tell me more about what you want to change.`;
  }
  return `I'm your planning assistant. I can: 1) build your perfect schedule, 2) fix your week when plans change, 3) break goals into daily steps, and 4) review your week and suggest improvements. Add a task or a goal first, and I'll get to work right away.`;
}

export function localReview(s = {}) {
  const completed = s.completedTasks ?? 0;
  const focusMinutes = s.focusMinutes ?? 0;
  const hours = Math.round(focusMinutes / 60);
  const hoursLabel = focusMinutes ? `${hours}h ${focusMinutes % 60}m` : 'no logged focus';
  const daysActive = s.daysActive ?? 0;
  const current = s.streaks?.current ?? 0;
  const best = s.streaks?.best ?? 0;

  const head = `## Your week at a glance\n\n- **Tasks completed:** ${completed}\n- **Focus time:** ${hoursLabel}\n- **Active days:** ${daysActive}\n- **Current streak:** ${current} days (best ${best})\n`;

  const wins = completed >= 10
    ? '## Wins to celebrate\n\nStrong finishing week — completing more than one or two tasks per active day compounds fast.'
    : completed >= 5
      ? '## Wins to celebrate\n\nSolid week of momentum. Every completed task is proof the system works when you show up.'
      : '## Wins to celebrate\n\nLook past the number: the real win is any task that had been sitting for weeks — you moved it.';

  const stretch = completed === 0 && focusMinutes === 0
    ? '## Honest check-in\n\nThis week looks quiet. That\'s okay — momentum starts with one small win. Pick a 25-minute task tonight and bank it.'
    : '';

  const body = '## What held you back\n\n- Over-scheduling small tasks instead of protecting one deep-work block per day.\n- Missing breaks — schedule them like meetings; they protect your focus.\n\n## Next week\n\n1. Protect **one 90-minute deep block** per day, same time, for your #1 priority.\n2. Batch low-priority tasks into a single 30-minute "admin" slot.\n3. **Tonight**: decide tomorrow\'s 3 must-dos and let the assistant build the day.';

  return `${head}\n\n${wins}\n\n${stretch ? `${stretch}\n\n` : ''}${body}`;
}