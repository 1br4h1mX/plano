/**
 * llm.js — direct browser calls to the user's own LLM provider.
 * Used only when the user pastes their own API key in Settings; the key is
 * sent straight to Anthropic/OpenAI and never stored anywhere else.
 */

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};

// Gemini and OpenRouter expose the same wire format as OpenAI's chat endpoint,
// so they share one code path — the key just goes to a different base URL.
const OPENAI_COMPAT_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};

/**
 * Calls the configured provider with a system prompt and user message.
 * Returns the raw text response.
 */
export async function clientComplete({ provider, apiKey, model, system, user, maxTokens = 3000 }) {
  if (!apiKey) throw new Error('No API key provided');
  const p = provider === 'anthropic' ? 'anthropic' : OPENAI_COMPAT_ENDPOINTS[provider] ? provider : 'openai';
  const resolvedModel = model || DEFAULT_MODELS[p] || DEFAULT_MODELS.openai;
  if (p === 'anthropic') return completeAnthropic(apiKey, resolvedModel, { system, user, maxTokens });
  return completeOpenAI(apiKey, resolvedModel, { system, user, maxTokens, baseUrl: OPENAI_COMPAT_ENDPOINTS[p] });
}

/** Cheap ping used by the "Test connection" button in Settings. */
export function testConnection(provider, apiKey, model) {
  return clientComplete({
    provider,
    apiKey,
    model,
    system: 'Reply with exactly one word: OK. Nothing else.',
    user: 'ping',
    maxTokens: 5,
  });
}

async function completeAnthropic(key, model, { system, user, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`${providerLabel('anthropic')} API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return data.content.map((c) => c.text || '').join('');
}

async function completeOpenAI(key, model, { system, user, maxTokens, baseUrl = OPENAI_COMPAT_ENDPOINTS.openai }) {
  const label = baseUrl.includes('generativelanguage') ? 'Google Gemini' : 'OpenAI';
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${label} API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function safeText(res) {
  try {
    const t = await res.text();
    return t.length > 300 ? `${t.slice(0, 300)}…` : t;
  } catch {
    return 'unknown error';
  }
}

function providerLabel(provider) {
  return provider === 'openai' ? 'OpenAI' : 'Anthropic';
}

/**
 * Robustly extracts a JSON object from an LLM response.
 * Handles markdown code fences and stray prose around the JSON.
 */
export function extractJson(text) {
  if (!text) throw new Error('Empty response from LLM');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('LLM did not return valid JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}