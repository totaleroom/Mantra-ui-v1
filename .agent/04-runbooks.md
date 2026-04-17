# 04 — Runbooks

> Copy-paste recipes for the tasks that come up repeatedly.

## R1 — Start local dev preview (no Docker, UI-only)

Use when: user wants to see the UI, Docker Desktop isn't running.

```powershell
# In repo root
# 1. Ensure .env.local exists (see 05-gotchas.md if missing)
# 2. Start the dev server
$env:PORT="5000"; npx next dev -p 5000
# 3. Open http://localhost:5000 in a real browser (not Windsurf preview — see G2)
```

Login with `admin@mantra.ai` + any non-empty password (DEV_AUTH_BYPASS).

Backend-dependent pages will show empty states. That's expected.

## R2 — Full stack preview (with Docker)

Use when: user wants real data flow end-to-end.

```powershell
# 1. Start Docker Desktop manually (GUI). Wait for green whale.
# 2. From repo root:
docker compose up -d --build
# 3. Watch logs
docker compose logs -f backend frontend evolution
# 4. Open http://localhost:5000
```

First boot takes ~3 min (Evolution seeds a SQLite, backend runs init.sql).

## R3 — Deploy to production (Coolify)

Full steps are in `DEPLOY_COOLIFY.md`. One-liner for re-deploy after code push:

1. Push to GitHub main branch.
2. Coolify auto-builds (webhook already configured).
3. Watch the build log in Coolify UI; ~4 min typical.
4. Run the smoke test in `README.md` § "Post-deploy Smoke Test".

## R4 — Add a new backend API endpoint

Example: `GET /api/clients/:id/usage`.

1. **Handler** — create/edit in `backend/handlers/`:
   ```go
   func GetClientUsage(c *fiber.Ctx) error {
       id, _ := strconv.Atoi(c.Params("id"))
       var usage models.UsageStats
       if err := database.DB.Where("client_id = ?", id).First(&usage).Error; err != nil {
           return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
       }
       return c.JSON(usage)
   }
   ```
2. **Register** in `backend/routes/routes.go` inside the authenticated group:
   ```go
   clients.Get("/:id/usage", middleware.RequireRole("CLIENT_ADMIN"), handlers.GetClientUsage)
   ```
3. **Frontend hook** — add to `hooks/use-clients.ts`:
   ```ts
   export function useClientUsage(id: number) {
     return useQuery({
       queryKey: ['clients', id, 'usage'],
       queryFn: () => apiClient.get(`/api/clients/${id}/usage`).then(r => r.data),
     })
   }
   ```
4. **Type** — add to `lib/api-types.ts` (create if not exists).
5. Verify: `06-verification.md` block B.

## R5 — Add a new dashboard page

Example: `/app/reports/page.tsx`.

1. Create `app/reports/page.tsx`:
   ```tsx
   import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
   export default function ReportsPage() {
     return (
       <DashboardLayout>
         <h1 className="text-2xl font-semibold">Reports</h1>
       </DashboardLayout>
     )
   }
   ```
2. Add to sidebar: `components/dashboard/sidebar.tsx::navItems`.
3. Add to command palette: `components/command-palette.tsx::commands`.
4. If it requires auth gate, `middleware.ts` already covers `/app/*`. Verify.

## R6 — Add a new env var

1. **Backend struct field** in `backend/config/config.go`:
   ```go
   type Config struct {
       // ...
       MyNewVar string
   }
   ```
   And in `Load()`:
   ```go
   MyNewVar: os.Getenv("MY_NEW_VAR"),
   ```
   Add validation in the production branch if required.
2. **Frontend Zod** in `lib/env.ts` (server or client schema, depending).
3. **.env.example**: add with a comment explaining what it does.
4. **docker-compose.yaml**: pass through to the relevant service's
   `environment:` block.
5. **Document** in `README.md` § Environment Variables table if it's notable.

## R7 — Debug "AI isn't replying to inbound messages"

Follow the pipeline, top-down. One of these steps IS broken.

```powershell
# 1. Is Evolution reaching our webhook?
docker compose logs backend | Select-String "Webhook"
# Expect: [Webhook] accepted msg=... client=...
# If silent: Evolution can't reach us. Check PUBLIC_BACKEND_URL + network.

# 2. Is the secret valid?
# If logs say "invalid webhook secret": WEBHOOK_SECRET mismatch.
docker compose exec evolution env | Select-String -Pattern "WEBHOOK"

# 3. Is orchestrator running?
docker compose logs backend | Select-String "Orchestrator"

# 4. Does the client have an AI config?
docker compose exec postgres psql -U mantra -d mantra -c `
  "SELECT client_id, model_id FROM client_ai_configs;"

# 5. Are there active AI providers?
docker compose exec postgres psql -U mantra -d mantra -c `
  "SELECT name, priority, is_active FROM ai_providers ORDER BY priority;"

# 6. Did AI call succeed?
docker compose logs backend | Select-String "AI call failed|all providers failed"

# 7. Did the outbound SendText succeed?
docker compose logs backend | Select-String "send text failed"
```

See `05-gotchas.md::G7-G11` for specific failure modes.

## R8 — Rotate JWT_SECRET in production

1. Generate new secret: `openssl rand -base64 48`.
2. Update `JWT_SECRET` in Coolify env (or VPS `.env`).
3. Redeploy backend.
4. All existing user sessions will be invalidated — users must re-login.
   This is expected behavior. Warn the human operator first.

## R9 — Purge stuck customer memory

If a specific customer's conversation is poisoned (bad context etc.):

```powershell
# Via backend API if you have an endpoint, else direct Redis:
docker compose exec redis redis-cli DEL "memory:1:6281234567890"
# Format: memory:{clientId}:{customerNumber}
```

Then delete from Postgres too:

```sql
DELETE FROM customer_memories
WHERE client_id = 1 AND customer_number = '6281234567890';
```

## R10 — Onboard a new tenant (human-friendly sequence)

See `README.md` § Post-deploy Smoke Test. The 7-step curl sequence is also the
onboarding runbook: it creates tenant → AI config → WA instance → QR → live.
