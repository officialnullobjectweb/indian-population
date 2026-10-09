# Deploying to Vercel (exact settings)

The repo is a zero-build static site (`index.html` at root). Use these settings —
anything else produces a `404 NOT_FOUND` / `DEPLOYMENT_NOT_FOUND` page.

## One-time project setup

1. Import `officialnullobjectweb/indian-population` (grant Vercel access to the
   private repo if asked).
2. **General → Root Directory:** empty (`./`) — `index.html` is at the repo root.
3. **Build & Development → Framework Preset:** `Other`.
4. **Build Command:** `npm run build` (regenerates `src/data/districts.json`; always exits 0).
   **Output Directory:** empty. **Install Command:** default (`npm install`).
5. **Git → Production Branch:** `main`.
6. **Deployment Protection → Vercel Authentication:** **OFF**, otherwise every URL
   redirects to a Vercel login page (302 → `vercel.com/sso-api`) instead of the map.
7. **Domains:** assign the domain you want (e.g. `indianpopmap.vercel.app`) to THIS
   project. A domain with no successful production deployment shows
   `404 DEPLOYMENT_NOT_FOUND`.

## Diagnose by symptom

| Symptom | Cause | Fix |
|---|---|---|
| `404 NOT_FOUND` on `/` | Build failed or output has no `index.html` | Check Deployments tab; fix Root/Output dirs above; redeploy |
| `404 DEPLOYMENT_NOT_FOUND` on domain | No production deployment / domain on wrong project | Promote a deployment to production; attach domain here |
| Redirect to Vercel login | Deployment Protection (SSO) is on | Settings → Deployment Protection → OFF |

## Local check

```bash
npm run build   # must exit 0
npx serve . -l 8080  # http://localhost:8080/ must render the map
```
