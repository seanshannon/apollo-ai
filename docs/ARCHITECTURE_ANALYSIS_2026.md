# Apollo.ai (Picard.ai) — Three-Pass Architecture Analysis

_Date: 2026-07-22 · Scope: full repository, focused on `nextjs_space/` (the application)_

---

## PASS 1 — Understanding the Application

### Purpose

A **natural-language database intelligence platform**: business users type questions in plain
English ("Who are my customers in California?"), an LLM translates them into SQL, the app
executes the SQL, and results come back with charts, maps, confidence scores, reasoning, and
suggested next steps. The current build is a **demo/prototype**: it queries five *seeded demo
datasets* (sales, HR, inventory, finance, customer support) that live as prefixed table groups
inside the app's own PostgreSQL database — not external customer databases.

### Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui (Radix), framer-motion, retro "terminal" theme |
| Auth | NextAuth 4 (JWT strategy), Credentials + Google OAuth, PrismaAdapter |
| ORM/DB | Prisma 6 → PostgreSQL |
| AI | Abacus.AI OpenAI-compatible proxy (`gpt-4.1-mini` for SQL generation and answer summarization, `text-embedding-3-small` for embeddings) |
| Vector DB | Pinecone (query-pattern memory / RAG few-shot retrieval) |
| Visualization | Chart.js + react-chartjs-2, Leaflet maps, custom heat map (plotly, recharts, mapbox-gl also in deps but unused) |
| Email | Resend (welcome emails) |
| i18n | i18next (en, es, fr, de) |
| Testing | Jest + Testing Library ("MC/DC" suites) |

### Entry points and layout

- `app/page.tsx` — landing/auth page (`components/auth-page.tsx`, incl. zero-knowledge signup components)
- `app/dashboard/` — the single main screen: database selector + `components/query-interface.tsx` (904 lines: input, voice input, SSE consumption, results, export, share)
- `app/share/[token]/page.tsx` — public shared-query viewer
- `middleware.ts` — security headers (CSP, HSTS, etc.) + an oversized-cookie force-logout guard
- ~20 API routes under `app/api/` — the important ones: `query` (core pipeline), `generate-answer`, `query-explain`, `query-history`, `schema-discovery`, `semantic-search`, `share-query`, `signup`, `organizations/*`, `user/*`, `vector-init`, `cache-stats`

### Core data flow (`POST /api/query`, `app/api/query/route.ts`)

1. In-memory IP rate limit (`lib/rate-limit.ts`) → session check → input length validation
2. Resolve user's organization (first owned/member org) → audit log (`lib/audit.ts`) → create `QueryHistory` row (PENDING)
3. Open an SSE stream to the client, then:
   - Check a module-level SQL cache (1h TTL) keyed on `query:databaseId`
   - On miss: fetch top-5 similar successful queries from Pinecone (`lib/vector-db.ts` → `lib/embeddings.ts`) and build a very large hand-written prompt (dialect rules, hard-coded schema text per database, enum-casing rules, US-state-code table, conversational-context and few-shot sections) → call LLM with `temperature: 0`, JSON response format, 50s abort timeout
4. Validate generated SQL with a regex allowlist (`validateSQL` in `lib/database-query-executor.ts` — SELECT-only, dangerous-keyword blocklist, ≤5 subqueries)
5. Execute via `prisma.$queryRawUnsafe` behind a multi-tier TTL/LRU cache (`lib/db-optimization.ts`)
6. Post-process: BigInt→string, PII masking (`lib/pii-masking.ts`), keyword-driven "next steps" injection, heuristic confidence score, viz-type selection, suggestions
7. Persist results to `QueryHistory`; fire-and-forget store of the successful pattern into Pinecone (a self-improving feedback loop); stream the final payload

The client then optionally calls `POST /api/generate-answer` (a second LLM call) for a prose answer.

### Data model (`prisma/schema.prisma`)

Two disjoint groups in one schema:
- **SaaS metadata**: `User`, `Account`, `Session`, `Organization`, `OrganizationMember` (OWNER/ADMIN/MEMBER/VIEWER), `ZKDatabaseConnection` (encrypted external DB credentials), `QueryHistory`, `AuditLog` — well-indexed, cascade deletes, proper unique constraints.
- **Demo "databases"**: `sales_*`, `hr_*`, `inv_*`, `fin_*`, `cust_*` tables. **These have no `organizationId`** — they are global demo data shared by all tenants.

### Aspirational vs. wired-up (important)

Several headline features are scaffolding, not reality:
- **"Universal database support"** — `getDatabaseConfig()` hard-codes `postgresql`; `lib/database-connections.ts#testConnection` returns `true` without connecting; no external DB driver exists. All queries run against the app's own Postgres.
- **"Zero-knowledge architecture"** — `lib/zero-knowledge-crypto.ts` is a textbook-correct client-side crypto library (PBKDF2 600k iterations, AES-GCM, non-extractable keys) and signup generates a salt, but query results are stored **plaintext** in `QueryHistory.results`.
- **~700 lines of dead code** — `executeByDatabase` and the five `execute*Query` keyword-matching functions in `database-query-executor.ts` are never called (the raw-SQL path replaced them).
- **Tests** — see Pass 2; the MC/DC suites largely test stub functions defined inside the test files.

---

## PASS 2 — Strengths Assessment

### Genuinely strong

1. **The RAG feedback loop for SQL generation** (`lib/vector-db.ts`, `app/api/query/route.ts`).
   Successful query→SQL pairs are embedded and stored in Pinecone; future generations retrieve the top similar successes (score > 0.75) as few-shot examples. This is a real, correctly-plumbed self-improvement mechanism most prototypes at this stage don't have.

2. **Prompt engineering discipline** (`generateQueryPrompt`, `getDbSchema` in `app/api/query/route.ts`).
   Dialect-specific quoting/limit rules for 7 database types, enum-casing warnings tied to actual Prisma enums, full-state-name→code conversion table, join guidance ("never return `productId` without the product name"), and a conversational-context section that teaches the model to mirror structure on follow-ups ("And the lowest?" → keep `LIMIT 1`). Chain-of-thought JSON output with confidence. This encodes a lot of hard-won failure knowledge.

3. **Security *intent* woven through the stack.** Multiple real layers exist: SELECT-only regex validation + subquery cap (`validateSQL`), input length limits, per-route rate limiters, strong password policy (12+ chars, complexity, common-password and sequence checks in `app/api/signup/route.ts`), bcrypt cost 12, an encryption module that **refuses to boot with a default key** (`lib/encryption.ts:10`), security-header middleware, SQL sanitized before logging (`sanitizeSQLForLogging`). The layers have holes (Pass 3), but the posture is far above typical demo code.

4. **Audit logging done properly** (`lib/audit.ts`). Non-blocking (`.catch`, never throws into the main flow), covers login success/failure with reasons, signup, query execute, sharing; `AuditLog` has four purpose-built composite indexes. Compliance-grade design.

5. **Streaming UX with graceful degradation** (`app/api/query/route.ts`). SSE progress events, an `AbortController` 50s timeout, granular fetch-error handling, and a translation table from technical errors to user-friendly messages ("column does not exist" → "Try rephrasing your question…"). Vector-DB failures degrade silently rather than failing the query.

6. **Accessibility effort well beyond the norm**: `aria-live` announcer, skip links, screen-reader result announcements, `prefers-reduced-motion` respected in scroll behavior (`components/query-interface.tsx:139`), keyboard-navigation hook, labeled form controls.

### Fine but unremarkable

- shadcn/Radix UI kit, Prisma singleton (`lib/db.ts`), TTL/LRU cache implementations, i18n wiring, CSV/JSON/PDF export, the confidence heuristic (`calculateConfidence` — reasonable, but it's vibes arithmetic, not calibration).
- PII masking (`lib/pii-masking.ts`): solid regexes for email/phone/SSN/credit card, but only string values are scanned, any 9-digit number matches as SSN, and names/addresses are unmasked despite being declared types.

### Weak despite appearances

1. **The test suite is largely performative.** `__tests__/comprehensive-mcdc.test.ts` (684 lines) tests `evaluateLoginDecision`, `evaluateSQLSafety`, etc. — **functions defined at the bottom of the test file itself**, not the application's code. `__tests__/api/query.test.ts` and `auth.test.ts` do the same (inline `validateQueryRequest`, inline `checkRateLimit`). No test imports an actual route or lib module. The MC/DC coverage reports in the repo therefore measure re-implementations, not the app. Real regressions in `validateSQL`, the query route, or auth would not be caught.

2. **Security has structural gaps beneath the good posture** (detailed in Pass 3): regex-validated LLM SQL into `$queryRawUnsafe`, no tenant scoping on data, app tables (`User` with password hashes, `AuditLog`, `ZKDatabaseConnection` with encrypted credentials) reachable by any generated SELECT, spoofable `x-forwarded-for` rate-limit keys, crypto-js passphrase AES (weak EVP KDF) for share tokens placed raw in URLs.

3. **Repo hygiene**: a real `cookies.txt` with NextAuth session/CSRF cookies is committed, along with `TEST_CREDENTIALS.md`, hundreds of files in `.logs/`, `next.config.js.backup{,2}`, ~40 change-log MD/PDF pairs in the root, dead scripts (`check_jennifer.ts`), a Prisma `output` path hard-coded to another machine (`/home/ubuntu/data_retriever_app/...`), a Pinecone key read from a hard-coded local file path (`lib/vector-db.ts:14`), and **no `prisma/migrations/` directory at all**. `browserslist` still targets IE 11 under React 19.

---

## PASS 3 — Next-Level Opportunities (ranked by impact ÷ effort)

### 1. Harden the SQL execution path with real isolation — **M effort, existential impact**
**Opportunity:** Generated SQL currently runs via `prisma.$queryRawUnsafe` on the app's own connection, guarded only by regex. Any SELECT the LLM can be talked into (natural language *is* the attack surface — "list all users with their password column") can read `User` password hashes, `AuditLog`, and `ZKDatabaseConnection.encryptedCredentials`. `validateSQL` will pass it because it's a SELECT.
**Why it matters:** This is the difference between a demo and something an organization can touch. It also blocks every multi-tenant ambition.
**First step:** Create a dedicated Postgres role with `SELECT` granted **only** on the demo tables, and run generated SQL over a separate connection using that role. Then replace the regex validator with a real parser (e.g. `pgsql-ast-parser`/`libpg_query`) that checks the table allowlist from the AST, and enforce a statement timeout + row cap server-side.

### 2. Make external database connections real — **L effort, transformative impact**
**Opportunity:** The product's core promise ("works with PostgreSQL, MySQL, Snowflake…") is stubbed: `testConnection` validates nothing, no driver exists, and `databaseId` is a 5-value enum. `ZKDatabaseConnection` (encrypted credentials, `schemaCache`, `lastSchemaSync`) is already modeled and waiting.
**Why it matters:** This converts the app from a seeded-data demo into the actual product. Everything else (billing tiers, orgs, roles) only matters after this.
**First step:** Implement one driver honestly — `pg` for external PostgreSQL: real `testConnection`, read-only enforcement (`default_transaction_read_only`), execute path per connection, wire the existing connection-management UI/API to it.

### 3. Dynamic schema introspection → prompt generation — **M effort, high impact**
**Opportunity:** ~500 lines of hand-maintained schema prose inside `app/api/query/route.ts` are the LLM's only knowledge of the data. Every schema change means editing a template literal; every new dataset is impossible.
**Why it matters:** It unlocks arbitrary datasets (prerequisite for #2), removes a huge maintenance tax, and shrinks the route file dramatically. The `schema-discovery` route and `schemaCache` column already exist as ingredients.
**First step:** Write an introspector (`information_schema` + `pg_catalog`) that emits the same shape the prompt needs (tables, columns, types, enum values, FKs, 3 sample rows), cache it in `ZKDatabaseConnection.schemaCache`, and have `generateQueryPrompt` consume it instead of the hard-coded strings.

### 4. A real test suite — **M effort, high impact (multiplier for everything else)**
**Opportunity:** Replace the self-referential MC/DC stubs with tests that import actual code: `validateSQL` against a bypass corpus (comments, `WITH` CTEs, `SELECT ... INTO`, function calls like `pg_read_file`, casing tricks), `maskPII` edge cases, route-level integration tests for `/api/query` with a test database and mocked LLM.
**Why it matters:** Refactors #1–#3 touch the most dangerous code in the app; today nothing would catch a regression. The illusion of coverage is worse than none.
**First step:** Delete or quarantine the stub-function suites; write ~20 table-driven tests for the real `validateSQL` (several will likely fail and reveal bypasses — e.g. `WITH x AS (SELECT ...) SELECT * FROM x` starts with `WITH`, and scalar-function abuse isn't blocked).

### 5. Agentic self-correction and true multi-turn analysis — **M effort, high UX impact**
**Opportunity:** When SQL fails, the user gets an apology. The pieces for a retry loop already exist: the error message, `findAlternativeQueries()` in `lib/vector-db.ts` (written, never called), and the SSE channel to narrate "adjusting the query…". Similarly, conversation context is limited to exactly one previous query.
**Why it matters:** Error-recovery loops are the single biggest perceived-intelligence upgrade for NL→SQL products; failed first attempts become successes instead of dead ends.
**First step:** In the query route's catch path, feed the failed SQL + database error back to the LLM once (max 2 attempts), reusing the existing prompt with an "the previous attempt failed because…" section; store only the final success in Pinecone.

### 6. Saved queries, dashboards, scheduled reports — **M/L effort, medium-high impact**
**Opportunity:** `QueryHistory` already persists results, viz configs are computed server-side, Resend email is wired, and `User.weeklyReport` exists as a dormant preference. Pinning queries to a dashboard grid and scheduling email digests turns a Q&A tool into a BI destination people return to.
**First step:** Add a `SavedQuery` model (name, query, databaseId, vizConfig, schedule) + a "pin this result" action in `query-interface.tsx`.

### 7. Model and streaming upgrade — **S effort, medium impact**
**Opportunity:** SQL generation uses `gpt-4.1-mini` through a proxy, and the "streaming" sends fake progress messages while buffering the whole completion. Moving to a current stronger model with native structured outputs (and streaming the reasoning text for real) improves accuracy and perceived speed for one afternoon of work.
**First step:** Parametrize model + endpoint via env vars; stream `reasoning` tokens through the existing SSE channel instead of the static "Analyzing…" message.

### 8. Repo & ops hygiene — **S effort, medium impact (credibility + safety)**
**Opportunity:** Remove committed secrets/artifacts (`cookies.txt`, `TEST_CREDENTIALS.*`, `.logs/`, backups), move the ~40 root reports to `/docs`, fix the Prisma generator `output` path, load the Pinecone key from env instead of `/home/ubuntu/...`, commit Prisma migrations, drop the dead keyword-matching executor (~700 lines) and unused chart libs (plotly, recharts, mapbox-gl), fix `browserslist`, add CI running lint + the (new) tests.
**First step:** `git rm` the secrets and logs (and rotate anything they exposed), add `prisma migrate dev` baseline, add a GitHub Actions workflow.

### Architectural limits that will block growth if left alone

1. **In-memory everything** — rate limits, SQL cache, query-result caches, and `setInterval` maintenance live in module scope. Two instances (or serverless) → inconsistent limits, cold caches, duplicated timers. Externalize to Redis/Upstash before any horizontal scaling.
2. **Global demo data, cosmetic tenancy** — `sales_*`/`hr_*`/etc. have no `organizationId`; orgs isolate only metadata. Real tenancy needs per-connection external DBs (#2) or per-org schemas.
3. **Hard-coded schema knowledge** (#3) — the LLM's world is a string constant; no new dataset can exist without editing the route.
4. **Environment-coupled configuration** — secrets from a local file path, Prisma output on another machine's path, Abacus preview URLs in committed cookies. The app currently only runs in the environment it was built in.
5. **No migrations** — schema evolution is currently `db push`-style and unreviewable; any production database will drift.
6. **NextAuth v4 + `allowDangerousEmailAccountLinking` + sleep-based OAuth race handling** (`lib/auth.ts:182`) — works today, but the 100–200ms `setTimeout` waits for the PrismaAdapter are a race condition, and the auth stack is a generation behind (Auth.js v5) with React 19/Next 15.

### Priority order (impact ÷ effort)

| # | Initiative | Effort | Impact |
|---|---|---|---|
| 1 | Restricted DB role + AST SQL validation | M | Existential (security) |
| 2 | Repo/ops hygiene incl. secret removal | S | Medium |
| 3 | Dynamic schema introspection | M | High |
| 4 | Real test suite | M | High (multiplier) |
| 5 | Self-correcting retry loop + multi-turn | M | High (UX) |
| 6 | Model/streaming upgrade | S | Medium |
| 7 | Real external DB connections | L | Transformative |
| 8 | Saved queries / dashboards / schedules | M–L | Medium-high |

Recommended sequence: **1 → 2 → 3 → 4 → 5** (each unblocks or de-risks the next), then **7** as the flagship investment, with **6** and **8** slotted in as capacity allows.
