# Deployment credentials and secret rotation

Status: credential handling is implemented. Production values live in the
deployment platform's encrypted environment-variable store and must never be
committed, pasted into tickets, or included in screenshots.

## Environment-variable inventory

| Variable | Required | Secret? | Purpose |
|---|---|---|---|
| `JWT_SECRET` | Yes | Yes | Signs seven-day API access tokens; startup fails if absent |
| `ADMIN_EMAIL` | No | Personal/config | Administrator identity to create or synchronize at boot |
| `ADMIN_PASSWORD` | With `ADMIN_EMAIL` | Yes | Creates or rotates the administrator password hash at boot |
| `DATABASE_URL` | Production | Yes | PostgreSQL connection URI, normally injected by the provider |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Local alternative | Partly | Split PostgreSQL configuration when `DATABASE_URL` is absent |
| `FRONTEND_URL` | Yes in production | No | Allowed browser origin for CORS |
| `PORT` | Provider-dependent | No | Backend listen port, default `3001` |
| `GPU_METRICS_MODE` | No | No | `auto`, `real`, or `mock`; use `real` on production GPU workers |
| `NEXT_PUBLIC_API_URL` | Frontend | No, public | Browser-visible backend API base URL |

Do not place server secrets in variables beginning with `NEXT_PUBLIC_` or
`VITE_`; those values are compiled into browser assets.

## Initial deployment

1. Copy `.env.example` only for local development. Keep the real `.env`
   untracked; `.gitignore` already excludes it.
2. Generate a signing secret locally:

   ```bash
   openssl rand -hex 32
   ```

3. Generate a unique administrator password with a password manager. Do not
   reuse the public demo password.
4. Add `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, and
   `FRONTEND_URL` to the backend provider's encrypted variable store.
5. Set `GPU_METRICS_MODE=real` only on a worker where `nvidia-smi` must be
   available. Use `mock` for the public frontend demo and `auto` for local
   development.
6. Deploy and verify that startup contains `Admin account seeded` or
   `Admin account synced from env` without printing any credential value.
7. Log in through TLS, verify `/auth/me`, then verify that a non-admin account
   cannot access the admin endpoint.

## Administrator password rotation

1. Generate a new unique password in the password manager.
2. Replace `ADMIN_PASSWORD` in the provider's secret store.
3. Redeploy or restart the backend. `UsersService.onApplicationBootstrap()`
   compares the new value with the stored bcrypt hash and replaces the hash
   when they differ.
4. Confirm the old password fails and the new password succeeds.
5. Revoke existing browser sessions by clearing their tokens. If immediate
   global token invalidation is required, rotate `JWT_SECRET` as described
   below.
6. Record only the rotation date, operator, deployment ID, and verification
   result—never the password.

## JWT signing-secret rotation

Rotating `JWT_SECRET` invalidates every existing JWT and requires all users to
sign in again.

1. Schedule a short authentication interruption and notify users.
2. Generate a new 32-byte or longer random value.
3. Replace `JWT_SECRET` in the provider store and redeploy all backend
   instances together; mixed signing secrets cause intermittent failures.
4. Confirm an old token receives `401`, a new login succeeds, and the new
   token can call `/auth/me`.
5. Record the rotation metadata without storing either secret.

## Database credential rotation

1. Take a provider snapshot or confirm point-in-time recovery.
2. Create/rotate the database credential in the database provider.
3. Update `DATABASE_URL` in the backend secret store immediately.
4. Redeploy and verify startup, a read endpoint, and a write followed by a
   read-back.
5. Revoke the old credential after every backend instance uses the new one.

## Redacted configuration evidence

Capture provider screenshots only after enabling the platform's “reveal
values” control **off**. A valid screenshot shows variable names, deployment
name, and update timestamp while values remain masked.

Required evidence files for a release audit:

| Evidence | Suggested path | Required visible information |
|---|---|---|
| Backend variable inventory | `docs/evidence/secrets/backend-env-redacted.png` | Variable names; every value masked |
| Frontend variable inventory | `docs/evidence/secrets/frontend-env-redacted.png` | Only public variable names; values may still be masked |
| Admin rotation deployment | `docs/evidence/secrets/admin-rotation-redacted.png` | Deployment ID/time and successful health status |
| Rotation verification | `docs/evidence/secrets/rotation-verification.md` | Old login rejected; new login accepted; no tokens |

Before committing screenshots, inspect them at full resolution for passwords,
connection strings, tokens, email addresses that should remain private, QR
codes, browser autofill overlays, and provider account identifiers. This
repository does not currently include screenshots because no deployment
dashboard was made available in this workspace.

## Audit commands

Run these before release; review matches rather than committing their output:

```bash
git ls-files | grep -E '(^|/)(\.env|id_rsa|id_ed25519)(\.|$)'
rg -n --hidden --glob '!**/.git/**' \
  '(BEGIN (RSA |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]+|AKIA[0-9A-Z]{16})'
git grep -nE '(JWT_SECRET|ADMIN_PASSWORD|DATABASE_URL)=' -- ':!*.example'
```

Expected result: no tracked private-key files, tokens, or populated server
secret assignments.
