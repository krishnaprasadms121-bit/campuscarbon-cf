/* CampusCarbon — Help Assistant backend (Cloudflare Worker)
   Called by src/index.js for /api/chat
   Runs on Cloudflare's edge, never in the browser, so the API key stays secret.
   Requires GEMINI_API_KEY set in: Cloudflare dashboard > Workers & Pages > campuscarbon-cf >
   Settings > Environment variables. */

const SYSTEM_PROMPT = `You are the CampusCarbon Help Assistant, embedded in a website that helps Indian universities and institutions understand, apply for, plan, and track carbon credit projects under India's Carbon Credit Trading Scheme (CCTS).

Stay strictly on topic: carbon credits, CCTS, the Indian Carbon Market (ICM) portal, ACVA verification, the Green Credit Programme, tree plantation / afforestation, biogas, solar projects, and directly related institutional sustainability topics. If asked something clearly unrelated, politely decline and steer the conversation back to carbon credits.

Be concise, accurate, and practical, with India-specific context. If you're not certain of a specific number, rule, or current policy detail, say so rather than inventing one. Mention the site's own Calculator, Apply, and Plan tabs when they'd genuinely help. Never claim to be a government body or an official verification agency — you are a helpful assistant, not a substitute for an ACVA or official guidance.`;

const GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest"];

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

export async function handleChat(request, env) {

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "GEMINI_API_KEY is not configured on this site yet." }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: "Invalid request body." }, 400);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return json({ error: "No messages provided." }, 400);
  }

  // Gemini uses "user" / "model" roles instead of "user" / "assistant"
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));

  let lastError = "";

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      GEMINI_MODELS[i] +
      ":generateContent?key=" +
      apiKey;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: contents,
          generationConfig: { maxOutputTokens: 700 },
        }),
      });

      if (!res.ok) {
        lastError = `[${GEMINI_MODELS[i]}] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
        continue;
      }

      const data = await res.json();
      const candidate = (data.candidates || [])[0];
      const parts = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : [];
      const text = parts.map((p) => p.text || "").join("\n").trim();

      if (!text) {
        const reason = candidate && candidate.finishReason ? candidate.finishReason : "unknown";
        lastError = `[${GEMINI_MODELS[i]}] Empty reply, finishReason: ${reason}`;
        continue;
      }

      return json({ text });
    } catch (err) {
      lastError = `[${GEMINI_MODELS[i]}] Network error: ${String(err).slice(0, 200)}`;
    }
  }

  return json({ error: "Request failed", detail: lastError }, 502);
}
