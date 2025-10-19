DreamPlay: Auto-Register on Allowlist (Netlify Functions)
=========================================================

This zip is a ready-to-deploy Netlify project that exposes:
  /.netlify/functions/referrer-sign?buyer=0x...

It returns a signed payload { referrer, deadline, signature } for buyers
found in your ALLOWLIST_CSV (Google Sheet CSV).

SETUP
-----
1) Create a new Netlify site from this folder (Import from Git OR drag the folder into a new site).
   Note: Functions require a build to install dependencies (ethers). If you use drag-and-drop zip
   without a build, functions won't run. Recommended: connect to Netlify using a repo OR enable a build.

2) In Netlify → Site settings → Environment Variables, add:
   - REGISTRAR_PK   = your registrar private key (never share this)
   - ALLOWLIST_CSV  = public CSV URL with columns: address, referrer (optional), deadline_days (optional)
   (Optional)
   - DEFAULT_REFERRER = 0x... fallback sponsor if CSV has no referrer
   - SIGNING_SCHEME  = "hash" (default) or "typed"

3) Deploy. After deploy, test:
   https://<yoursite>.netlify.app/.netlify/functions/referrer-sign?buyer=0xYourWallet

4) In your dApp, after wallet connect, fetch the payload and call your register function.
