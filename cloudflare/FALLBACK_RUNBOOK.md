# Phosters Fallback Architecture Guide ($5/mo Cloudflare Plan)

Phosters currently runs on **Vercel + Supabase** (zero-AI build: manual Tests, Mock Exams, and Question Bank + Web Push).

Keep this folder ready as a **zero-rewrite fallback** if you hit Vercel bandwidth/serverless limits or want to lock hosting to a flat **$5/month**.

---

## Monthly Cost Ceiling (Domain Excluded)

| Service | Fallback Choice | Monthly Cost |
|---|---|---:|
| App + Static Assets + Push API + Daily Cron | **Cloudflare Workers Paid** | **$5.00** |
| CDN / SSL / DDoS | **Cloudflare Free** | **$0.00** |
| Database + Auth | **Supabase Free** (or Neon Free if Supabase egress/DB limit is hit) | **$0.00** |
| Study Material Files (if ever needed beyond GitHub raw links) | **Cloudflare R2 (10 GB Free, $0 egress)** | **$0.00** |
| AI API | **None required (removed)** | **$0.00** |
| **Total** | | **$5.00 / mo** |

---

## How to Activate the Cloudflare Fallback (Later)

1. **Build the Vite PWA bundle** (make sure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_VAPID_PUBLIC_KEY` are set in your shell or `.env`):
   ```bash
   npm run build
   ```

2. **Set Worker secrets once** (`npx wrangler secret put <NAME> --config cloudflare/wrangler.jsonc`):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for unattended daily `0 16 * * *` inactivity push cron)
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (e.g. `mailto:notifications@phosters.com`)
   - `CRON_SECRET`

3. **Deploy to Cloudflare Workers**:
   ```bash
   npx wrangler deploy --config cloudflare/wrangler.jsonc
   ```

4. **Point your custom domain** in Cloudflare Dashboard → Workers & Pages → `phosters` → **Settings → Domains & Routes**, and add your new production URL under **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**.

---

## If You Also Hit Supabase Free Limits (500 MB DB / 5 GB Egress)

1. **First line of defense ($0):** Keep lesson PDFs on GitHub (`raw.githubusercontent.com`) or Cloudflare R2 (10 GB free, $0 egress) instead of Supabase Storage, and encourage students to use the PWA **Offline Library** so repeated study sessions read from local IndexedDB instead of Supabase egress.
2. **If you outgrow 500 MB DB:** Because Phosters only relies on standard Postgres + Auth (no Supabase Storage blobs), you can either prune old `test_attempts`/`push_notification_logs` rows or move the heavy read tables behind Cloudflare Workers + Hyperdrive/Neon within the same $5/mo ceiling.
