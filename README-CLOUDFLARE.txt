CAMPUSCARBON — MOVED TO CLOUDFLARE PAGES
=========================================

WHY
---
Netlify's free plan is now 300 credits per month, and every
production deploy costs 15 credits. That is only 20 deploys a
month. When credits run out, Netlify SUSPENDS the site for the
rest of the calendar month.

Cloudflare Pages free plan gives:
  - 500 builds per month (25x more deploys)
  - Unlimited bandwidth
  - 100,000 function requests PER DAY
  - Never expires, no credit card needed


WHAT CHANGED IN THE CODE
------------------------
Old (Netlify)                      New (Cloudflare)
-----------------------------------------------------------
netlify/functions/chat.js       -> functions/api/chat.js
netlify/functions/plant-scan.js -> functions/api/plant-scan.js
/.netlify/functions/chat        -> /api/chat
/.netlify/functions/plant-scan  -> /api/plant-scan
netlify.toml                    -> deleted, not needed

The way functions are written is also different:
  Netlify:    exports.handler = async (event) => {...}
  Cloudflare: export async function onRequestPost(context) {...}

Everything the user sees is identical. Same scanner, same
Help Assistant, same design.


FOLDER STRUCTURE (IMPORTANT)
----------------------------
campuscarbon/
  index.html
  app.js
  style.css
  functions/
    api/
      chat.js
      plant-scan.js

The "functions" folder must sit next to index.html.
Cloudflare automatically turns functions/api/chat.js into
the web address /api/chat. You do not configure this.


THE ONE THING YOU MUST NOT FORGET
---------------------------------
Add GEMINI_API_KEY in Cloudflare, or nothing will work:
  Cloudflare dashboard > Workers & Pages > campuscarbon
  > Settings > Environment variables (Production)
  Name:  GEMINI_API_KEY
  Value: your existing key from Netlify

You can copy the value from Netlify before it locks you out:
  Netlify > Site configuration > Environment variables


ABOUT YOUR OLD NETLIFY SITE
---------------------------
Leave it alone. Do not delete it. On 1 September your credits
reset and it comes back on its own, which is a useful backup.

Your GitHub repo stays exactly where it is. Both Netlify and
Cloudflare can watch the same repo at the same time.


NOTE ON analyze.js
------------------
Your repo has netlify/functions/analyze.js, but nothing in
app.js ever calls it. It was not carried over. If you did use
it for something, tell Claude and it can be converted too.
