# Secrets & git history — status and runbook

**Last verified:** 2026-08-16 (gitleaks 8.30.1, 678 commits scanned)

---

## 1. What is actually in git history

`gitleaks detect --source . --redact` reports **19 findings**. Triaged:

| File | Findings | Verdict |
|---|---|---|
| `infrastructure/hostinger/.env.splaro.co.production` (commit `9a9f55c3`, 2026-07-08) | 6 | **Real production secrets — all since rotated** (see §2) |
| `.github/workflows/ci.yml` (`caec808a`, `2c3c9dcd`, `c1b5d59c`, `9f917231`) | 6 | CI-only dummies. Hashes do **not** match production. Current workflow no longer hardcodes them. |
| `apps/api/src/modules/payments/nagad.service.ts` (`9f917231`) | 1 | `private-key` rule. Nagad sandbox key committed in an early revision. Replace if the same key is still used with the live gateway. |
| `apps/api/src/modules/auth/admin-login-token.service.ts` (`66f87a2b`) | 1 | False positive — `TOKEN_CHARS` alphabet constant. |
| `apps/api/test/app.e2e-spec.ts` (`9633fb51`) | 1 | False positive — test fixture. |
| `ADMIN_API_ROUTES_SUMMARY.md`, `docs/system-health.md` | 4 | Doc examples (`curl -H "Authorization: Bearer …"`), placeholder values. |

CI runs gitleaks with `--no-git` (working tree only), so these historical blobs do
not fail builds. Switch that flag off once the purge below has run.

## 2. Rotation status — proven by hash comparison, never by reading values

Method: SHA-256 the value from the leaked blob, SHA-256 the value live on the VPS,
compare the first 12 hex chars. Values are never printed or copied.

```
key                       leaked 2026-07-08   live on VPS        verdict
JWT_SECRET                72014125a994 (48)   6676e81980bb (64)  rotated
JWT_REFRESH_SECRET        411f58220ff6 (48)   58798c2ca316 (48)  rotated
ADMIN_SESSION_SECRET      2fc5a107fc38 (32)   <rotated 08-16>    rotated
REVALIDATE_SECRET         bdffa851acda (24)   cc3e7e72a376 (48)  rotated
INTERNAL_HEALTH_SECRET    71c4d2f988f7 (24)   14bd1056e9c5 (48)  rotated
ENCRYPTION_KEY            c77431a0a13f (32)   80f1bdfcecab (32)  rotated
DATABASE_URL              86047baeaf42 (130)  99020fdd0bf7 (82)  rotated
MYSQL_* / SPLARO_HOSTINGER  present           not set            Hostinger-era, gone
```

Every leaked value is dead. That is why the history purge below is hygiene, not
incident response.

### Key reuse found during the same check

Two pairs shared one value — a leak of either half would have unlocked both:

- `JWT_SECRET` == `ADMIN_SESSION_SECRET`
- `REVALIDATE_SECRET` == `INVOICE_ACCESS_SECRET`

Resolved 2026-08-16 by rotating `ADMIN_SESSION_SECRET` and
`INVOICE_ACCESS_SECRET` to fresh independent values, with
`INVOICE_ACCESS_SECRET_PREVIOUS` set so invoice and tracking links issued under
the old secret keep verifying during the rollover window.

**Remove `INVOICE_ACCESS_SECRET_PREVIOUS` after ~30 days** (once old invoice
links are no longer in circulation) so a single stale secret cannot linger.

## 3. Rotating a secret safely

Generate on the box, so the value never travels and nobody has to read it:

```bash
ssh splaro-vps
cd /var/www/splaro
cp -a .env ".env.bak.$(date +%Y%m%d-%H%M%S)"          # 600, root:root

NEW=$(openssl rand -hex 32)
# Rollover pair first, where the code supports one (invoice access, encryption):
OLD=$(grep -m1 '^INVOICE_ACCESS_SECRET=' .env | cut -d= -f2-)
sed -i "s|^INVOICE_ACCESS_SECRET=.*|INVOICE_ACCESS_SECRET=$NEW|" .env
grep -q '^INVOICE_ACCESS_SECRET_PREVIOUS=' .env \
  && sed -i "s|^INVOICE_ACCESS_SECRET_PREVIOUS=.*|INVOICE_ACCESS_SECRET_PREVIOUS=$OLD|" .env \
  || echo "INVOICE_ACCESS_SECRET_PREVIOUS=$OLD" >> .env
unset NEW OLD

pm2 reload all --update-env
curl -fsS https://api.splaro.co/api/v1/health
```

Which secrets support a rollover window:

| Secret | Rollover key | Blast radius if rotated without one |
|---|---|---|
| `INVOICE_ACCESS_SECRET` | `INVOICE_ACCESS_SECRET_PREVIOUS` | Existing invoice / tracking links 403 |
| `ENCRYPTION_KEY` | `ENCRYPTION_KEY_PREVIOUS` | Saved integration credentials unreadable until re-saved in admin |
| `ADMIN_SESSION_SECRET` | none | Every admin logged out; log back in via Telegram OTP |
| `JWT_SECRET` | none | Customer sessions invalidated |
| `INTERNAL_HEALTH_SECRET` | none | Web→API internal calls fail until both sides reload |

## 4. History purge runbook — not yet executed

Deliberately deferred: every leaked value is already dead (§2), while the purge
rewrites all 678 commits, changes every SHA, and forces every clone and open
branch to be recreated. Run it during a quiet window with no open PRs.

```bash
# 0. Everyone pushes their work first. Confirm no open PRs.
pipx install git-filter-repo            # or: brew install git-filter-repo

# 1. Full backup that is not a branch (survives the rewrite)
git clone --mirror git@github.com:sourove-a/SPLARO.git splaro-backup.git
tar czf splaro-backup-$(date +%F).tar.gz splaro-backup.git

# 2. Rewrite a fresh mirror
git clone --mirror git@github.com:sourove-a/SPLARO.git splaro-purge.git
cd splaro-purge.git
git filter-repo --invert-paths \
  --path infrastructure/hostinger/.env.splaro.co.production \
  --path ADMIN_API_ROUTES_SUMMARY.md

# The nagad key sits inside a file that is still live — scrub the value, keep the file:
printf '%s\n' 'literal:<nagad-private-key-value>==>REDACTED' > ../replace.txt
git filter-repo --replace-text ../replace.txt

# 3. Verify the blobs are gone before publishing
gitleaks detect --source . --redact --no-banner   # expect the 6 .env findings gone

# 4. Publish (destructive)
git push --force --mirror git@github.com:sourove-a/SPLARO.git

# 5. Everyone re-clones. Old clones must NOT be pushed from again.
```

After the purge:

- Flip CI's secret scan from `--no-git` to a full history scan
  (`.github/workflows/ci.yml`, "Secret scan" step) so regressions fail the build.
- Re-run `gitleaks detect` on a fresh clone and attach the output here.

## 5. Standing rules

- `.gitignore` already blocks `.env`, `*.env`, and the hostinger production env.
  CI's "Block committed env files" step is the backstop — keep it.
- Never paste a secret into a workflow file. CI generates its own throwaway values.
- Rotate on the box with `openssl rand`; do not move secrets through a laptop,
  a chat window, or a ticket.
