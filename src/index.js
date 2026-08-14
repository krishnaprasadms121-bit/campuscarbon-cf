/* CampusCarbon — Cloudflare Worker entry point

   This file decides what happens for every web address on the site:
     /api/chat        -> the Help Assistant
     /api/plant-scan  -> the Plant Scanner
     everything else  -> the website files in the public/ folder

   You should not need to edit this file. */

import { handleChat } from "./chat.js";
import { handlePlantScan } from "./plant-scan.js";

function methodNotAllowed() {
  return new Response(JSON.stringify({ error: "Use POST for this address." }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
