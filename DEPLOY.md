# Deploying to Vercel (exact settings)

Next.js app (`next build` output). Use these settings.

## One-time project setup

1. Import `officialnullobjectweb/indian-population` (grant Vercel access to the
   private repo if asked).
2. **General → Root Directory:** empty (`./`) — the Next.js app is at the repo root.
3. **Build & Development → Framework Preset:** `Next.js` (auto-detected via `next`).
4. **Build Command:** `next build` (or default). **Output Directory:** default (`.next`).
   **Install Command:** default (`npm install`).
5. **Git → Production Branch:** `main`.
6. **Deployment Protection → Vercel Authentication:** **OFF**, otherwise every URL
   redirects to a Vercel login page (302 → `vercel.com/sso-api`) instead of the map.
7. **Domains:** assign the domain you want to THIS project. A domain with no
   successful production deployment shows `404 DEPLOYMENT_NOT_FOUND`.

## Diagnose by symptom

| Symptom | Cause | Fix |
|---|---|---|
| `404 NOT_FOUND` on `/` | Build failed, or output has no `index` route | Check Deployments tab; fix settings above; redeploy |
| `404 DEPLOYMENT_NOT_FOUND` on domain | No production deployment / domain on wrong project | Promote a deployment to production; attach domain here |
| Redirect to Vercel login | Deployment Protection (SSO) is on | Settings → Deployment Protection → OFF |
| Only `/data/*` serves (200) | Root/Output Directory points at `public/` | Clear both fields; **Redeploy** |

## Local check

```bash
npm run build   # must exit 0
npm start -- -p 8080  # http://localhost:8080/ must render the map
```
