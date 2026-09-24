/**
 * aiConfig.js — "bring your own key" storage.
 * The user's own Anthropic/OpenAI key lives in localStorage only and is sent
 * straight to the provider from the browser. It is never uploaded to any Plano
 * server.
 */

const STORAGE_KEY = 'plano:ai:v1';

const DEFAULTS = { provider: 'gemini', apiKey: '', model: '' };

export function getAIConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    /* corrupted -> defaults */
  }
  return { ...DEFAULTS };
}

export function aiConfigured() {
  return Boolean((getAIConfig().apiKey || '').trim());
}

export function saveAIConfig(patch) {
  const next = { ...getAIConfig(), ...patch, apiKey: (patch.apiKey ?? getAIConfig().apiKey ?? '').trim() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full/unavailable — keep in-memory defaults */
  }
  return next;
}

export function clearAIConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function providerLabel(provider) {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'gemini') return 'Google Gemini';
  return 'Anthropic';
}