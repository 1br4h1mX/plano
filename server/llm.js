import 'dotenv/config';

const providers = [
  { key: 'ANTHROPIC_API_KEY', value: process.env.ANTHROPIC_API_KEY, name: 'anthropic' },
  { key: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY, name: 'openai' },
  { key: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY, name: 'gemini' },
].filter((p) => p.value);

export function config() {
  const preferred = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  const byName = providers.find((p) => p.name === preferred);
  if (preferred !== 'auto' && byName) return byName;
  // Prefer Anthropic when both are configured; otherwise the first configured.
  const anthropic = providers.find((p) => p.name === 'anthropic');
  return anthropic || providers[0] || null;
}

/**
 * Calls the configured LLM provider with a system prompt and user message.
 * Returns the raw text response. Never sends the API key to the browser.
 */
export async function complete({ system, user, maxTokens = 3000 }) {
  const provider = config();
  if (!provider) {
    const err = new Error('No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY in server/.env');
    err.status = 503;
    throw err;
  }

  if (provider.name === 'anthropic') return completeAnthropic(provider.key, { system, user, maxTokens });
  if (provider.name === 'openai') return completeOpenAI(provider.key, { system, user, maxTokens });
  return completeGemini(provider.key, { system, user, maxTokens });
}

async function completeAnthropic(key, { system, user, maxTokens }) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return data.content.map((c) => c.text || '').join('');
}

async function completeOpenAI(key, { system, user, maxTokens }) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function completeGemini(key, { system, user, maxTokens }) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('') || '';
}

async function safeText(res) {
  try {
    const t = await res.text();
    return t.length > 300 ? `${t.slice(0, 300)}…` : t;
  } catch {
    return 'unknown error';
  }
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