/* CampusCarbon — Plant & Tree Scanner backend (Cloudflare Worker)
   Called by src/index.js for /api/plant-scan
   Runs on Cloudflare's edge, never in the browser, so the API key stays secret.
   Requires GEMINI_API_KEY set in: Cloudflare dashboard > Workers & Pages > campuscarbon-cf >
   Settings > Environment variables. */

// Model list. Tried in order — if one is retired or busy, the next is used.
// "gemini-flash-latest" is an alias Google keeps pointing at a live model,
// so it acts as a permanent safety net against future shutdowns.
const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a botanist and plant pathologist assisting users of CampusCarbon, an Indian sustainability platform. You will receive one or more photographs of a plant or tree, and possibly the user's location and answers to a few questions.

HOW TO IDENTIFY
- Use the location, if given, to narrow down species. A plant photographed in Tamil Nadu is far more likely to be a locally common species than an exotic one.
- If several species look alike in the photo, list the alternatives instead of picking one at random.
- Set confidence honestly. "high" only when the photo clearly shows diagnostic features. If the photo is blurry, distant, or shows only a generic green leaf, say "low".

HOW TO DIAGNOSE
- Only report a problem you can actually SEE evidence of in the photo. Never invent symptoms.
- Use the user's answers. Spreading to nearby plants suggests something infectious. Not spreading suggests nutrient, water, or soil issues. Sudden onset suggests shock or pests; slow onset suggests deficiency.
- Many problems look identical in a photograph. Fungal and bacterial leaf spot often cannot be told apart by eye. Root rot, nematodes and drought all show as wilting. When this is the case, SAY SO in the caution field rather than guessing.
- If the plant looks healthy, say so and leave problems empty.

SAFETY RULES — these are not optional
- Never give pesticide or fungicide dosages, concentrations, dilution ratios, or spray schedules. Wrong chemical advice can destroy a crop or harm the person applying it.
- For chemicalTreatment, name the general class of product only (for example "a copper-based fungicide") and always add that the local agriculture extension officer or Krishi Vigyan Kendra should confirm the product and quantity.
- Organic and cultural remedies (pruning, spacing, drainage, neem oil, removing affected leaves) may be described in practical detail.

Reply with ONLY a JSON object. No markdown, no backticks, no text before or after.

{
  "isPlant": true,
  "imageQuality": "good | fair | poor",
  "identification": {
    "commonName": "",
    "botanicalName": "",
    "localNames": "",
    "family": "",
    "confidence": "high | medium | low",
    "alternatives": [{ "name": "", "howToTellApart": "" }]
  },
  "about": {
    "description": "",
    "nativeRegion": "",
    "matureSize": "",
    "lifespan": "",
    "uses": "",
    "sunlight": "",
    "water": "",
    "soil": "",
    "carbonNote": ""
  },
  "health": {
    "status": "healthy | problem detected | cannot tell",
    "summary": "",
    "problems": [
      {
        "name": "",
        "type": "fungal | bacterial | viral | pest | nutrient deficiency | watering | environmental",
        "visibleSigns": "",
        "confidence": "high | medium | low",
        "organicTreatment": "",
        "chemicalTreatment": "",
        "prevention": ""
      }
    ]
  },
  "betterPhotoTip": "",
  "caution": ""
}

For carbonNote, add one short line on whether this species is suitable for campus afforestation or carbon-credit planting in India, since this site is about carbon credits. Keep it to one sentence.
For betterPhotoTip, say what photo would improve the answer — but leave it as an empty string if the photos were already good.
Always fill caution with the honest limits of this diagnosis.`;

export async function handlePlantScan(request, env) {

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

  const images = Array.isArray(payload.images) ? payload.images : [];
  if (images.length === 0) {
    return json({ error: "No photo received." }, 400);
  }

  // Build the text half of the prompt from whatever context the user gave us.
  const lines = [];
  if (payload.location && payload.location.lat) {
    lines.push(
      `User's location: latitude ${payload.location.lat}, longitude ${payload.location.lng}. Use this to narrow down likely species.`
    );
  }
  if (payload.month) lines.push(`Current month: ${payload.month}. Consider seasonal diseases.`);
  if (payload.duration) lines.push(`How long the plant has looked like this: ${payload.duration}`);
  if (payload.watering) lines.push(`Watering frequency: ${payload.watering}`);
  if (payload.spreading) lines.push(`Are nearby plants also affected: ${payload.spreading}`);
  if (payload.notes) lines.push(`Extra notes from user: ${String(payload.notes).slice(0, 300)}`);

  const contextText =
    lines.length > 0
      ? "Context provided by the user:\n" + lines.join("\n")
      : "The user provided no extra context. Rely on the photos alone and lower your confidence accordingly.";

  // Photos are sent in a known order so the model knows what it is looking at.
  const parts = [{ text: contextText }];
  images.slice(0, 4).forEach(function (img) {
    if (!img || !img.data) return;
    parts.push({ text: `Photo — ${img.label || "plant"}:` });
    parts.push({
      inline_data: {
        mime_type: img.mimeType || "image/jpeg",
        data: img.data,
      },
    });
  });

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
          contents: [{ role: "user", parts: parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1400,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });

      if (!res.ok) {
        lastError = `[${GEMINI_MODELS[i]}] HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`;
        continue;
      }

      const data = await res.json();
      const candidate = (data.candidates || [])[0];
      const partsOut = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : [];
      const text = partsOut.map((p) => p.text || "").join("").trim();

      if (!text) {
        const reason = candidate && candidate.finishReason ? candidate.finishReason : "unknown";
        lastError = `[${GEMINI_MODELS[i]}] Empty reply, finishReason: ${reason}`;
        continue;
      }

      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

      try {
        return json(JSON.parse(cleaned));
      } catch (e) {
        lastError = `[${GEMINI_MODELS[i]}] Reply was not valid JSON: ${cleaned.slice(0, 300)}`;
        continue;
      }
    } catch (err) {
      lastError = `[${GEMINI_MODELS[i]}] Network error: ${String(err).slice(0, 300)}`;
    }
  }

  return json({ error: "Scan failed", detail: lastError }, 502);
}
