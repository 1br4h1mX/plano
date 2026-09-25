/**
 * aiClient.js — the single access point for every AI action in the app.
 *
 * Resolution order per action:
 *   1. KEY MODE  — if the user saved their own LLM key in Settings, call the
 *      provider directly from the browser (server prompts, same engine).
 *   2. BACKEND   — otherwise try the Express server (/api).
 *   3. OFFLINE   — if no backend is reachable, run the built-in on-device
 *      engine (planner + rule-based chat/review).
 * So the AI always works, with or without a key, with or without a server.
 */

import { api } from './api.js';
import { buildPlan, validateSchedule } from './planner.js';
import { localChatReply, localReview } from './offlineAI.js';
import { clientComplete, extractJson } from './llm.js';
import { getAIConfig, aiConfigured } from './aiConfig.js';
import { llmOps, offlineOps } from './aiActions.js';
import { SCHEDULE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, REVIEW_SYSTEM_PROMPT } from '../../server/prompts.js';

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

const lastUserMessage = (messages) =>
  [...(messages || [])].reverse().find((m) => m?.role === 'user')?.content || '';

const contextText = (context) => (context || []).map((c) => `- ${c}`).join('\n');

async function withOwnKey(fn) {
  const cfg = getAIConfig();
  if (aiConfigured()) {
    try {
      return await fn(cfg);
    } catch (err) {
      return { owner: 'local', error: err, retry: () => fn(cfg) };
    }
  }
  return null;
}

export const ai = {
  /** True when the user's own key (or a reachable backend with an LLM) is active. */
  async aiHealth() {
    if (aiConfigured()) return { aiConfigured: true };
    const r = await api.aiHealth();
    return r;
  },

  async generateSchedule(input) {
    const attempt = await withOwnKey(async (cfg) => {
      const raw = await clientComplete({
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        system: SCHEDULE_SYSTEM_PROMPT,
        user: promptForBuild(input, input.missedDate ? 'reschedule' : 'build'),
      });
      const { plan, warnings } = validateSchedule(extractJson(raw));
      return { source: 'llm', plan, warnings, raw };
    });

    if (attempt?.owner === 'local') {
      return { source: 'local', plan: buildPlan(input), warnings: [`Your AI request failed (${attempt.error.message}). Using the built-in planner instead.`] };
    }
    if (attempt) return attempt;
    return api.generateSchedule(input);
  },

  async reschedule(missedDate, input) {
    const merged = { ...(input || {}), missedDate: missedDate || input?.missedDate };
    const attempt = await withOwnKey(async (cfg) => {
      const raw = await clientComplete({
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        system: SCHEDULE_SYSTEM_PROMPT,
        user: promptForBuild(merged, 'reschedule'),
      });
      const { plan, warnings } = validateSchedule(extractJson(raw));
      return { source: 'llm', plan, warnings, raw };
    });

    if (attempt?.owner === 'local') {
      return { source: 'local', plan: buildPlan(merged), warnings: [`Your AI request failed (${attempt.error.message}). Rebuilt on-device instead.`] };
    }
    if (attempt) return attempt;
    return api.reschedule(missedDate, input);
  },

  async chat(messages, context = []) {
    const attempt = await withOwnKey(async (cfg) => {
      const history = (messages || [])
        .filter((m) => m && m.role && m.content)
        .slice(-12)
        .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
        .join('\n');
      const user = `LIVE USER CONTEXT:\n${contextText(context)}\n\nCONVERSATION SO FAR:\n${history}`;
      const reply = await clientComplete({
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        system: CHAT_SYSTEM_PROMPT,
        user,
        maxTokens: 800,
      });
      return { reply: reply.trim() };
    });

    if (attempt?.owner === 'local') {
      return { reply: localChatReply(lastUserMessage(messages), context) };
    }
    if (attempt) return attempt;
    return api.chat(messages, context);
  },

  async weeklyReview(stats) {
    const sum = {
      completedTasks: stats?.completedTasks ?? 0,
      focusMinutes: stats?.focusMinutes ?? 0,
      streaks: stats?.streaks ?? { current: 0, best: 0 },
      daysActive: stats?.daysActive ?? 0,
    };
    const attempt = await withOwnKey(async (cfg) => {
      const user =
        `THIS WEEK'S STATS: completed ${sum.completedTasks} task(s), ${Math.round(sum.focusMinutes / 60)}h ${sum.focusMinutes % 60}m of focus, ${sum.daysActive} active day(s), current streak ${sum.streaks.current} (best ${sum.streaks.best}).`;
      const review = await clientComplete({
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        system: REVIEW_SYSTEM_PROMPT,
        user,
        maxTokens: 900,
      });
      return { review: review.trim(), stats: sum };
    });

    if (attempt?.owner === 'local') {
      return { review: localReview(sum), stats: sum };
    }
    if (attempt) return attempt;
    return api.weeklyReview(stats);
  },

  /**
   * Turns a natural-language request into schedule operations.
   * Uses the user's own key when present, otherwise the built-in parser.
   * Returns { text, ops } — ops[] is empty when the user was just chatting.
   */
  async applyOps(input) {
    const attempt = await withOwnKey(async (cfg) =>
      llmOps({
        query: input?.query,
        tasks: input?.tasks,
        settings: input?.settings,
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
      }),
    );

    if (attempt?.owner === 'local') return offlineOps(input?.query, input);
    if (attempt) return attempt;
    return offlineOps(input?.query, input);
  },
};

export { aiConfigured };