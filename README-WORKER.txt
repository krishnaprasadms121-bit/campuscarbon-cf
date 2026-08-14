CAMPUSCARBON — CLOUDFLARE WORKER (CORRECT VERSION)
===================================================

WHAT WENT WRONG LAST TIME
-------------------------
Cloudflare created a WORKER project, not a PAGES project.
The build log showed this line:

  "We have identified a `functions` directory ... Is this correct?"
  "Using fallback value in non-interactive context: no"

Because it answered "no", your two function files were uploaded
as plain text files instead of being run as code. The website
loaded, but /api/plant-scan and /api/chat did not exist.

It also uploaded your entire .git folder to the public internet,
because the whole repo root was treated as the website.


WHAT IS DIFFERENT NOW
---------------------
New folder layout:

  wrangler.jsonc        <- tells Cloudflare how to run everything
  .gitignore
  public/               <- the website (only this is public)
    index.html
    style.css
    app.js
  src/                  <- the code (never downloadable)
    index.js            <- decides which address does what
    chat.js             <- Help Assistant
    plant-scan.js       <- Plant Scanner

Now only the public/ folder is served as a website, so .git and
your source code are no longer exposed.

src/index.js sends /api/chat and /api/plant-scan to the right
code, and everything else to the public/ folder.


STEPS
-----
1. Delete the old files from your campuscarbon-cf repo:
     index.html, app.js, style.css, and the whole functions folder
   (On GitHub: open the file > three dots > Delete file > Commit)

2. Upload the new files, in TWO drags:
     First drag the "public" folder on its own.
     Then drag the "src" folder on its own.
     Then drag wrangler.jsonc and README-WORKER.txt.

3. Commit.

4. Cloudflare will build automatically. Watch Deployments.

5. Confirm GEMINI_API_KEY is still set:
     Workers & Pages > campuscarbon-cf > Settings
     > Variables and Secrets
   If you add or change it, click Retry build afterwards.


HOW TO TELL IT WORKED
---------------------
The build log should NOT contain the line about a "functions
directory". It should say it is using your wrangler.jsonc and
uploading only 3 assets (index.html, style.css, app.js).

Then open your .workers.dev address:
  - Scan Plant > add one photo > Scan plant
  - Help Assistant > ask "what is the capital of Japan?"
    It should refuse politely and talk about carbon credits.

