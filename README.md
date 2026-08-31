# Shitur — Marine Shift Scheduling

Reconstructed from the latest `marine-shifts-vercel` production deployment.

## Local structure

- `index.html`, `app.js`, `styles.css` — the recovered browser application.
- `api/airtable.js` — a rebuilt Vercel Function that proxies approved Airtable requests without exposing credentials to the browser.

## Vercel environment variables

Configure these values in the Vercel project for Production, Preview, and Development:

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`

Never commit the real token. Copy `.env.example` only as a local template.

## Manager printing

The manager screen offers two print scopes for the currently displayed month:

- Full month — the regular monthly calendar.
- Weekend — Friday and Saturday only.
