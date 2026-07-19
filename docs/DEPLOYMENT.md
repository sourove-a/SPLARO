# SPLARO — Production Deployment Guide

This is the source of truth for humans and AI coding agents deploying SPLARO.
Production runs on the Contabo VPS at `147.93.171.45`; Hostinger is email/legacy infrastructure only.

## Safe release contract

1. Finish all fixes locally before shipping.
2. Run the checks for every changed app. For storefront changes: `pnpm check:web`.
3. Never stage with `git add -A`; stage only files changed for the release.
4. Never commit `.env`, credentials, backups, local launch files, or unrelated worktree changes.
5. Push `main` only with owner approval. CI must pass before the VPS workflow starts.
6. Watch both GitHub workflows to completion, then verify the live site yourself.
7. Green means verified HTTP/API success. A running PM2 process alone is not proof.

---

## Standard automatic deploy

```bash
git status --short
pnpm check:web
git add <only-the-files-you-changed>
git commit -m "type(scope): concise summary"
git push origin main

gh run list --limit 5
gh run watch <ci-run-id> --exit-status
gh run list --limit 5
gh run watch <deploy-run-id> --exit-status
```

---

`main` push runs `CI`. A successful CI run triggers `Deploy VPS` with that exact approved commit SHA. Deploy runs are queued and must not be cancelled midway.

## Live verification

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://splaro.co
curl -s -o /dev/null -w "%{http_code}\n" https://splaro.co/shop
curl -sf https://splaro.co/api/v1/health
curl -sf https://admin.splaro.co/api/ping
curl -sf https://splaro.co/api/build-id

ssh -i ~/.ssh/splaro_vps -o BatchMode=yes root@147.93.171.45 \
  "cd /var/www/splaro && git rev-parse HEAD && pm2 status"
```

---

The live Git SHA must match the pushed SHA. Storefront, shop, API, admin ping, and required PM2 apps must all be healthy before reporting success.

## VPS recovery

Normal entry point:

```bash
ssh -i ~/.ssh/splaro_vps -o BatchMode=yes root@147.93.171.45
cd /var/www/splaro
bash /opt/splaro/deploy.sh
```

If deploy logs show missing or corrupted Next manifests, clean only the generated Next directories, then run the repository deploy script:

```bash
ssh -i ~/.ssh/splaro_vps root@147.93.171.45 \
  "cd /var/www/splaro && rm -rf apps/web/.next apps/admin/.next && bash infrastructure/vps/deploy.sh"
```

Read failed workflow logs before recovery:

```bash
gh run view <deploy-run-id> --log-failed
```

---

## AI agent boundaries

- Read `AGENTS.md`, `.cursor/skills/splaro-platform/SKILL.md`, and `AI_GUIDE.md` before changing production behavior.
- Do not deploy unrelated local changes.
- Do not edit locked footer or Google auth code unless the owner explicitly asks.
- Keep storefront browser requests behind same-origin BFF routes.
- Keep native scroll on Windows/mobile and never introduce dual page scrollports.
- Never expose secrets in output, commits, docs, or workflow logs.
- Never report deployment success until CI, Deploy VPS, live HTTP checks, build ID, and PM2 state are verified.
