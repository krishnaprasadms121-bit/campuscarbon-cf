/* CampusCarbon — Cloudflare Worker entry point

   Routes:
     /api/chat        -> the Help Assistant
     /api/plant-scan  -> the Plant Scanner
     /api/debug       -> TEMPORARY diagnostic page (remove once fixed)
     everything else  -> the website files in the public/ folder */

import { handleChat } from "./chat.js";
import { handlePlantScan } from "./plant-scan.js";

function methodNotAllowed() {
  return new Response(JSON.stringify({ error: "Use POST for this address." }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
}

/* TEMPORARY. This reveals NO secret values — only whether they exist,
   how long they are, and what names the Worker can see. Delete this
   route once the scanner is working. */
function debugInfo(env) {
  const names = [];
  for (const key in env) names.push(key);

  const raw = env.GEMINI_API_KEY;
  const type = typeof raw;
  const value = type === "string" ? raw : "";

  return new Response(
    JSON.stringify(
      {
        gemini_key_found: type === "string" && value.length > 0,
        gemini_key_type: type,
        gemini_key_length: value.length,
        gemini_key_starts_with: value ? value.slice(0, 3) : "",
        gemini_key_has_spaces: value !== value.trim(),
        all_binding_names_the_worker_can_see: names,
        assets_binding_present: typeof env.ASSETS === "object",
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json" } }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/debug") {
      return debugInfo(env);
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleChat(request, env);
    }

    if (url.pathname === "/api/plant-scan") {
      if (request.method !== "POST") return methodNotAllowed();
      return handlePlantScan(request, env);
    }

    // Anything else is a normal website file (index.html, style.css, app.js)
    return env.ASSETS.fetch(request);
  },
};
