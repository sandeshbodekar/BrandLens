# BrandLens MVP: Software Requirements Specification (SRS) and Build Plan

> **How to use this file.** Put it in the repo root as `SRS.md`. Give it to your AI coding tool at the start of every session and say which **phase** (section 12) to build. Build one phase at a time, run the app, check the acceptance criteria, then commit.
> **Rule reminder:** only work done inside the build window (Mon 16 Nov 10:00 AM to Thu 19 Nov 10:00 AM IST) is judged. Do not scaffold code before it opens. Reading this file and creating an empty repo is fine.

---

## 1. Product summary

**BrandLens** is a pre-publication brand-governance platform. A creator submits content (post, ad, email or document). The system checks it against the organisation's approved **guidelines (clauses)**, **approved facts**, and **terminology**. Every finding shows the exact text, why it was flagged, the **cited rule or fact**, a severity and a **suggested correction**. The creator accepts, edits or dismisses each suggestion. A **reviewer** then comments and approves or requests changes. Humans make every final decision.

**Core principle: "No source, no flag."** Every finding must cite a real clause or fact that exists in the knowledge base. Findings that fail verification are dropped.

**Hackathon scoring focus (Round 2):** the core workflow must run end to end and a judge must be able to use it without help:

`Knowledge base -> submit draft -> findings with cited sources -> accept/edit/dismiss -> submit for approval -> reviewer approves or requests changes`

---

## 2. Scope

### 2.1 In scope for the Round 2 MVP (must work)
1. Login with 3 roles (admin, creator, reviewer) and a one-click **Try demo** per role.
2. Knowledge Base: clauses, facts (with validity dates), terms. Paste-text guideline import. Seeded fictional brand.
3. Draft submission by pasting text (content types: post, ad, email, document).
4. Review engine: deterministic rule checks, plus LLM review grounded only in the knowledge base, plus a verifier. Falls back to rules-only if the LLM is unavailable or turned off.
5. Findings screen: highlighted text, finding cards with reason, source, severity, suggestion.
6. Accept / edit / dismiss (with optional reason) and "apply accepted fixes", which creates a new version.
7. Versions and revision history.
8. Submit for approval, reviewer queue, comments, approve or request changes.
9. Audit log of key actions.
10. AI-use disclosure banner and PII masking before external calls.
11. Deployed link, seeded demo data, README with disclosures.

### 2.2 Should have (only if time remains)
- DOCX upload for drafts and for guideline import.
- Anchored line comments (comment attached to a text range).
- Inline diff view for suggestions.

### 2.3 Out of scope for Round 2 (planned for Round 3)
These are the **three named improvements** and must not be built now:
1. **Evidence-grounded claim and outdated-fact verification**: retrieval with embeddings (Atlas vector search), claim-to-fact matching with confidence, richer fact conflicts.
2. **Image and accessibility checks**: image upload, WCAG contrast ratio, alt-text check, palette/logo checks.
3. **Guideline Health insights dashboard**: recurring issues, most-dismissed clauses, "possibly unclear guideline" flags, trends.

Also out of scope: SSO, email notifications, multi-language, real-time collaboration, payments.

> **Note on the outdated-fact check.** A simple deterministic version (stale value strings stored on a fact) is part of the MVP because it is cheap and demonstrates the idea. The deeper version is Round 3 improvement 1.

---

## 3. Users and roles

| Role | Can do |
|---|---|
| **admin** (brand manager) | Everything: manage clauses/facts/terms, toggle AI mode, view all drafts, approve, reset demo data |
| **creator** | Create drafts, run review, accept/edit/dismiss findings, apply fixes, submit for approval, comment, view own drafts |
| **reviewer** | View submitted drafts, comment, approve or request changes. Cannot edit the knowledge base |

All data is scoped by `workspaceId`. A user can only access data in their own workspace.

---

## 4. Tech stack and repo layout

- **Frontend:** React 18 + Vite, React Router, Tailwind CSS, `lucide-react` icons.
- **Backend:** Node.js 20 + Express, Mongoose, `zod` (validation), `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `express-rate-limit`, `morgan`, `dotenv`, `multer` + `mammoth` (only if DOCX is built).
- **Database:** MongoDB Atlas (free tier).
- **LLM:** one provider behind an adapter (section 7.6). Provider and model come from environment variables.
- **Deploy:** client on Vercel, server on Render, DB on Atlas.

```
brandlens/
  SRS.md
  README.md
  .gitignore
  client/
    src/
      main.jsx, App.jsx, api.js
      context/AuthContext.jsx
      components/ (Layout, Navbar, DisclosureBanner, SeverityBadge, FindingCard,
                   HighlightedText, CommentList, VersionList, StatusPill)
      pages/ (Login, DraftList, NewDraft, DraftReview, Knowledge, ReviewQueue)
  server/
    src/
      index.js, app.js, config.js
      models/ (User, Workspace, Clause, Fact, Term, Draft, DraftVersion,
               Finding, Comment, Review, AuditLog)
      middleware/ (auth.js, requireRole.js, error.js, validate.js)
      routes/ (auth, workspace, clauses, facts, terms, drafts, findings,
               comments, demo)
      services/ (reviewPipeline.js, ruleChecks.js, verifier.js,
                 piiMask.js, applyFixes.js, audit.js, segment.js)
      llm/ (index.js, prompt.js)
      seed/ (seed.js, brandData.js)
    .env.example
```

### 4.1 Environment variables (`server/.env.example`)
```
PORT=5000
MONGODB_URI=
JWT_SECRET=
CLIENT_ORIGIN=http://localhost:5173
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
LLM_TIMEOUT_MS=20000
```
Client: `VITE_API_URL=http://localhost:5000`. **Never commit `.env`.**

---

## 5. Data model (Mongoose)

All documents have `createdAt` / `updatedAt` (use `timestamps: true`). All except `User` and `Workspace` carry `workspaceId` (indexed).

```
Workspace  { name, description, aiEnabled: Boolean (default true) }

User       { name, email (unique), passwordHash, role: 'admin'|'creator'|'reviewer',
             workspaceId }

Clause     { workspaceId, code: String (e.g. "C-4.2"),
             category: 'tone'|'terminology'|'claims'|'legal'|'visual'|'accessibility',
             title, text, severityDefault: 'high'|'medium'|'low', active: Boolean }

Fact       { workspaceId, code (e.g. "F-20"), statement,
             currentText: String (optional, e.g. "Rs 109"),
             staleVariants: [String] (e.g. ["Rs 99", "₹99"]),
             validFrom: Date, validTo: Date|null, active: Boolean }

Term       { workspaceId, preferred: String, banned: [String],
             clauseCode: String, note }

Draft      { workspaceId, title, contentType: 'post'|'ad'|'email'|'document',
             createdBy: ObjectId(User),
             status: 'draft'|'checked'|'submitted'|'approved'|'changes_requested',
             currentVersion: Number }

DraftVersion { draftId, version: Number, text: String, createdBy, note: String }

Finding    { draftId, version: Number,
             quote: String, start: Number, end: Number,
             type: 'tone'|'terminology'|'claim'|'fact_conflict'|'outdated_fact'
                   |'legal'|'other',
             severity: 'high'|'medium'|'low',
             clauseCode: String|null, factCode: String|null,
             explanation: String, suggestion: String,
             confidence: Number (0..1),
             origin: 'rule'|'ai',
             decision: 'pending'|'accepted'|'edited'|'dismissed',
             editedSuggestion: String|null, decisionReason: String|null,
             decidedBy: ObjectId|null, decidedAt: Date|null }

Comment    { draftId, version, authorId, text,
             anchorStart: Number|null, anchorEnd: Number|null }

Review     { draftId, version, reviewerId, decision: 'approved'|'changes_requested',
             note }

AuditLog   { workspaceId, actorId, action: String, entity: String,
             entityId: ObjectId, meta: Object }
```

**Indexes:** `Finding(draftId, version)`, `DraftVersion(draftId, version)` unique, `Clause(workspaceId, code)` unique, `Fact(workspaceId, code)` unique.

---

## 6. Workflow state machine

```
draft --(Run review)--> checked
checked --(Edit text / apply fixes)--> draft   (new version)
checked --(Submit for approval)--> submitted
submitted --(Reviewer: approve)--> approved     (locked)
submitted --(Reviewer: request changes)--> changes_requested
changes_requested --(Creator edits)--> draft    (new version)
```

Rules:
- **Submit** is allowed only if the current version has been reviewed and **no `high` severity finding is still `pending`**. Each high finding must be accepted, edited or dismissed (dismissal of a high finding needs a reason).
- **Approved** drafts are read-only. Editing is blocked with a clear message.
- Every transition writes an `AuditLog` row.

---

## 7. Functional requirements

### 7.1 Authentication
- `POST /api/auth/login {email, password}` returns `{token, user}`. JWT expires in 12 h.
- `POST /api/auth/demo {role}` returns a token for the seeded demo user of that role (public, used by "Try demo" buttons).
- `GET /api/auth/me` returns the current user and workspace.
- Passwords hashed with bcrypt. All other routes require `Authorization: Bearer <token>`.
- Middleware `requireRole(...roles)` for role checks. Every query is filtered by the user's `workspaceId`.

Seeded users (password `Demo@1234` for all):
`admin@freshnest.demo`, `creator@freshnest.demo`, `reviewer@freshnest.demo`.

### 7.2 Knowledge Base (admin only to write, everyone in workspace can read)
- CRUD for clauses, facts, terms: `GET/POST/PUT/DELETE /api/clauses`, `/api/facts`, `/api/terms`.
- `POST /api/clauses/import {text}`: splits pasted guideline text into clauses. Rule: split on blank lines; a leading pattern like `1.2`, `C-4.2` or `1)` becomes the code, otherwise auto-code `C-AUTO-n`; the first sentence becomes the title. Returns a **preview list** the admin confirms before saving (`POST /api/clauses/bulk`).
- A fact is **valid** when `active` and `validFrom <= today` and (`validTo` is null or `validTo >= today`).
- UI: three tabs (Clauses, Facts, Terms), table plus "Add" form, delete with confirmation.

### 7.3 Drafts and versions
- `POST /api/drafts {title, contentType, text}` creates draft + version 1 (status `draft`).
- `GET /api/drafts`: creators see their own; reviewers see `submitted`/`approved`/`changes_requested`; admin sees all. Supports `?status=`.
- `GET /api/drafts/:id` returns draft, current version text, findings of the current version, comments, versions list.
- `PUT /api/drafts/:id/text {text, note}` creates a new version (blocked if approved). Status returns to `draft`.
- `GET /api/drafts/:id/versions/:n` returns an older version (read-only view).
- Text limit: 10,000 characters.

### 7.4 Review
- `POST /api/drafts/:id/review` runs the pipeline (section 8) on the **current version**, replaces any previous findings for that version, sets status `checked`, writes an audit row. Returns `{findings, mode: 'ai+rules'|'rules-only', dropped: n}`.

### 7.5 Decisions and fixes
- `PATCH /api/findings/:id {decision: 'accepted'|'edited'|'dismissed', editedSuggestion?, reason?}`.
- `POST /api/drafts/:id/apply-accepted`: for all findings with decision `accepted` or `edited` on the current version, replace `[start, end)` with the suggestion (or `editedSuggestion`). Apply in **descending start order** so offsets stay valid. Skip overlapping ranges (keep the first). Creates a new version with note `Applied N fixes`. Returns the new version.

### 7.6 Approval and comments
- `POST /api/drafts/:id/submit`: creator only; enforces the rules in section 6.
- `POST /api/drafts/:id/decision {decision: 'approved'|'changes_requested', note}`: reviewer/admin only; draft must be `submitted`; `changes_requested` requires a note. Creates a `Review` row.
- `GET/POST /api/drafts/:id/comments {text, anchorStart?, anchorEnd?}`.
- `GET /api/drafts/:id/audit` returns the audit trail for that draft.

### 7.7 Demo and settings
- `PATCH /api/workspace {aiEnabled}` (admin): toggles AI mode (rules-only when false).
- `POST /api/demo/reset` (admin): wipes and reseeds the workspace so judges can start fresh.
- `GET /api/health` returns `{ok: true}`.

---

## 8. Review pipeline specification (core of the product)

Implemented in `server/src/services/reviewPipeline.js`. Input: `draftId`, version text, workspace. Steps:

### Step 1: Segment
Split text into sentences (regex on `.`, `!`, `?`, newline) while tracking original character offsets. Used for rule checks and as context. Keep it simple and deterministic.

### Step 2: Rule checks (deterministic, `ruleChecks.js`)
Each rule returns findings with `origin: 'rule'`, `confidence: 1`.

| Rule | Logic | type | severity | Citation |
|---|---|---|---|---|
| R1 Banned terms | For each `Term.banned` item, case-insensitive whole-word match | `terminology` | medium | `term.clauseCode`; suggestion = `term.preferred` |
| R2 Absolute / superlative claims | Regex list: `#1`, `no. 1`, `number one`, `best`, `healthiest`, `guaranteed`, `100%`, `cure`, `miracle`, `proven`, `risk-free`, `fastest`, `cheapest` | `claim` | high | First active clause with `category: 'claims'`; explanation says no approved fact supports it |
| R3 Stale fact values | For each valid `Fact` with `staleVariants`, find any variant in the text | `outdated_fact` | medium | `factCode`; suggestion = `fact.currentText` |
| R4 Shouting | 3 or more ALL-CAPS words (3+ letters) in one sentence, or 3+ `!` in the text | `tone` | low | First active clause with `category: 'tone'` |

If two rule findings overlap, keep the higher severity one.

### Step 3: LLM review (skipped if `workspace.aiEnabled === false` or the call fails)
1. **Mask PII** in the draft text (`piiMask.js`): emails become `[EMAIL]`, 10-digit phone numbers become `[PHONE]`.
2. For the MVP, send **all active clauses and all currently valid facts** in the prompt. (Brand knowledge bases in the demo are small, around 10 to 40 items. Retrieval with embeddings is Round 3 improvement 1.)
3. Call the LLM with `temperature: 0`, timeout `LLM_TIMEOUT_MS`.

**Adapter contract (`llm/index.js`):** `complete({ system, user }) -> Promise<string>`. Provider chosen by `LLM_PROVIDER`; model by `LLM_MODEL`. No other file talks to the provider SDK.

**System prompt (`llm/prompt.js`):**
```
You are a brand-compliance reviewer. Review the DRAFT against ONLY the
CLAUSES and FACTS provided. Do not use outside knowledge or invent rules.
Report an issue only if you can cite a clause code or fact code from the lists.
Preserve the author's intent: suggestions must replace only the quoted text
and keep its meaning.
Return ONLY a JSON array, no prose, no markdown. Each item:
{
 "quote": "exact text copied from the DRAFT",
 "type": "tone|terminology|claim|fact_conflict|outdated_fact|legal|other",
 "severity": "high|medium|low",
 "clauseCode": "code from CLAUSES or null",
 "factCode": "code from FACTS or null",
 "explanation": "one sentence, under 30 words, saying why this breaks the cited source",
 "suggestion": "replacement for the quote only",
 "confidence": 0.0-1.0
}
If there are no issues return [].
```
**User message:** `CLAUSES:\n<code>: <title> - <text>\n...\n\nFACTS (valid today):\n<code>: <statement>\n...\n\nDRAFT:\n<masked text>`

### Step 4: Verify (`verifier.js`) — "no source, no flag"
Parse the model output safely (strip code fences, `JSON.parse` in try/catch; on failure treat as zero AI findings). For each item, **drop it** unless all hold:
1. `quote` is a non-empty substring of the **original (unmasked)** text. Compute `start/end` with `indexOf` (first match not already used).
2. At least one of `clauseCode` / `factCode` exists in this workspace's active clauses / valid facts.
3. `type` and `severity` are in the allowed enums; `suggestion` is a non-empty string and is not identical to the quote.
4. Not a duplicate of an existing finding (same range).

If an AI finding overlaps a rule finding, keep the rule finding and append the AI explanation only if it adds a different cited source. Findings with `confidence < 0.5` stay but are labelled **Needs human judgement** in the UI. Return `{findings, dropped}`.

### Step 5: Persist
Delete old findings for this draft version, insert the new ones sorted by `start`, set draft status to `checked`, write `AuditLog` (`review_run`, meta: counts, mode, dropped).

### Failure behaviour
LLM timeout, bad key or parse error returns `mode: 'rules-only'` plus a visible UI notice. The review must never crash the request.

---

## 9. Frontend requirements

### Routes
| Route | Page | Roles |
|---|---|---|
| `/login` | Login + three "Try demo" buttons (Admin / Creator / Reviewer) | public |
| `/drafts` | My drafts list (status pills, filter by status) | creator, admin |
| `/drafts/new` | Title, content type, textarea, "Create draft" | creator, admin |
| `/drafts/:id` | **Review page** (main screen) | all |
| `/knowledge` | Clauses / Facts / Terms tabs, paste-import | admin (read-only for others) |
| `/queue` | Submitted drafts waiting for review | reviewer, admin |

### Review page layout (`/drafts/:id`)
- **Header:** title, status pill, version selector, buttons: **Run review**, **Apply accepted fixes**, **Submit for approval** (creator) or **Approve / Request changes** (reviewer).
- **Disclosure banner:** "AI-assisted review. Draft text is sent to an external AI service with emails and phone numbers masked. Admins can switch to rules-only mode." Shows a `Rules-only mode` badge when active.
- **Left:** draft text with highlighted ranges (red = high, amber = medium, grey = low). Clicking a highlight scrolls to and selects its finding card. Editable in a textarea mode with "Save new version".
- **Right (tabs):**
  - **Findings:** cards sorted by position. Each card: severity badge, type, the quote, explanation, **Source** chip (clause or fact code, hover shows its text), confidence / "Needs human judgement" tag, suggested fix, buttons **Accept**, **Edit** (inline input), **Dismiss** (asks for reason; required for high).
  - **Comments:** list + add form.
  - **History:** version list (click to view read-only), audit trail.
- Summary bar: counts by severity and by decision, e.g. "5 findings: 3 high, 1 medium, 1 low. 2 pending."
- Empty, loading and error states for every call. Buttons disabled while a request is running.

### UI quality bar
Clean and readable, consistent spacing, responsive down to tablet width, keyboard-focusable buttons, colour never the only signal (use text labels with severity).

---

## 10. Non-functional requirements

- **Security:** hashed passwords, JWT expiry, role checks on every route, `helmet`, CORS limited to `CLIENT_ORIGIN`, `express-rate-limit` (for example 100 req/15 min, stricter on login and review), input validation with `zod`, upload size/type limits if DOCX is built.
- **Privacy:** workspace isolation in every query; PII masking before the external call; disclosure banner; rules-only mode.
- **Reliability:** review endpoint always returns a result (fallback to rules-only); centralised error handler; no unhandled promise rejections.
- **Performance:** review of a 1,000-word draft should finish within about 15 seconds with AI, under 1 second rules-only.
- **Transparency:** README lists every AI tool, model, library and any AI-generated code.

---

## 11. Seed data (fictional brand: FreshNest Organic Foods)

Implement in `server/src/seed/brandData.js`. IDs match the Round 1 PDF example.

**Clauses**
| code | category | title | text | default severity |
|---|---|---|---|---|
| C-4.2 | claims | Superlative claims need proof | Words like best, #1, healthiest, or 100% may be used only when an approved fact supports them. | high |
| C-5.1 | legal | No health or medical claims | Never claim that a product cures, treats, prevents or boosts any health condition, including immunity. | high |
| C-6.1 | legal | Offers need exact end dates | Any offer must state an exact end date, not a month or "limited time". | medium |
| V-2 | tone | Friendly, not pushy | Use a warm, friendly voice. Avoid urgency phrases such as "buy now" or "hurry". | low |
| T-1 | terminology | Preferred product terms | Call our products "cold-pressed juice". Do not use the words detox or miracle. | medium |
| C-7.1 | claims | Ingredient accuracy | Ingredient and nutrition statements must match the approved facts exactly. | high |

**Facts**
| code | statement | currentText | staleVariants | validFrom | validTo |
|---|---|---|---|---|---|
| F-12 | Our juices contain no added sugar. They contain natural fruit sugar. | no added sugar | [] | 2026-01-01 | null |
| F-15 | Our juices are cold-pressed in small batches in Pune. | | [] | 2026-01-01 | null |
| F-20 | The price of a 300 ml bottle is Rs 109. | Rs 109 | ["Rs 99", "Rs. 99", "₹99"] | 2026-10-01 | null |
| F-21 | Juices have a shelf life of 5 days when refrigerated. | | [] | 2026-01-01 | null |

**Terms**
`preferred: "cold-pressed juice"`, `banned: ["detox", "miracle", "cure"]`, `clauseCode: "T-1"`.

**Sample drafts (created by seed for the creator user)**
1. *Summer launch post* (post): `Our juice is India's #1 healthiest drink and 100% sugar free - guaranteed to boost immunity! Buy now at just Rs 99 (offer valid till Dec).` Expected: claim, fact conflict, health claim, outdated price, offer end date, tone.
2. *Clean announcement* (post): `Meet our new mango cold-pressed juice. Made in small batches in Pune with no added sugar. Available now for Rs 109.` Expected: zero or very few findings (shows it does not over-flag).
3. *Weekend email* (email): `HURRY!!! Our DETOX juice pack is selling out FAST!!! Grab 2 bottles at Rs 99 each.` Expected: banned term, shouting, stale price, tone.
4. *Product page copy* (document): `Our miracle green juice is a natural cure for tiredness and the fastest way to get your vitamins.` Expected: banned terms, health claim, superlative claim.

Each sample draft must demonstrate at least one accept, one edit and one dismiss path in the demo.

---

## 12. Build plan, phases and commits

Rules for committing: **one commit per working step**, run the app before committing, small commits with Conventional Commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Commit directly to `main`; tag milestones (`v0.1` ... `v0.6`). Judges may read the history, so it should tell the story of your work.

### Phase 0: Scaffold and deploy (Mon 10:00 to 11:00)
Build: monorepo, `client` (Vite React + Tailwind), `server` (Express, health route), Atlas connection, deploy both blank apps, confirm the client can call `/api/health` in production.
Commits:
1. `chore: initialise monorepo with client and server folders`
2. `feat(server): express app with health route and mongo connection`
3. `feat(client): vite react app with tailwind and router shell`
4. `chore: add env example, gitignore and deploy config`
**Done when:** deployed client page shows "API OK" from the deployed server. Tag `v0.1`.

### Phase 1: Auth, roles, demo login (Mon 11:00 to 13:00)
Build: User + Workspace models, login, demo login, JWT middleware, `requireRole`, Login page with three demo buttons, protected routes, navbar showing role.
Commits:
5. `feat(server): user and workspace models with password hashing`
6. `feat(server): jwt login, demo login and auth middleware`
7. `feat(client): login page with demo buttons and auth context`
8. `feat(client): protected routes and role-based navbar`
**Done when:** each demo button logs in and shows the right nav items; a creator cannot open `/knowledge` write actions. Tag `v0.2`.

### Phase 2: Knowledge Base and seed (Mon 14:00 to 16:30)
Build: Clause, Fact, Term models and CRUD routes; seed script and `POST /api/demo/reset`; Knowledge page with three tabs; paste-import with preview.
Commits:
9. `feat(server): clause fact and term models with crud routes`
10. `feat(server): seed script for FreshNest brand and demo reset`
11. `feat(client): knowledge page with clauses facts and terms tabs`
12. `feat: paste guideline import with preview and bulk save`
**Done when:** admin sees the seeded knowledge base, can add/edit/delete an item, and import pasted guideline text. Tag `v0.3`.

### Phase 3: Drafts and review pipeline (Mon 16:30 to 19:30)
Build: Draft, DraftVersion, Finding models; draft create/list/get; segmentation; rule checks R1 to R4; PII masking; LLM adapter and prompt; verifier; `POST /review`; fallback to rules-only.
Commits:
13. `feat(server): draft and version models with create and list routes`
14. `feat(server): rule checks for terms, claims, stale facts and shouting`
15. `feat(server): llm adapter, prompt and pii masking`
16. `feat(server): verifier that drops findings without a real source`
17. `feat(server): review endpoint with rules-only fallback`
**Done when:** calling review on sample draft 1 returns the expected findings with valid codes, and with a wrong API key it still returns rule findings with `mode: 'rules-only'`. Tag `v0.4`.

### Phase 4: Findings screen (Mon 20:30 to 23:00)
Build: New Draft page, Draft list, Review page (header, highlights, finding cards, summary bar, disclosure banner).
Commits:
18. `feat(client): draft list and new draft pages`
19. `feat(client): review page with highlighted text and finding cards`
20. `feat(client): disclosure banner, severity badges and summary bar`
**Done when:** a creator can paste text, click Run review and see highlighted issues with reasons and sources. Tag `v0.5`.

### Phase 5: Decisions, fixes, versions (Tue morning)
Build: finding PATCH, accept/edit/dismiss UI, apply-accepted fixes, new versions, version selector and read-only old versions.
Commits:
21. `feat(server): finding decisions and apply-accepted fixes`
22. `feat(client): accept, edit and dismiss controls on findings`
23. `feat: version history with read-only older versions`
**Done when:** accepting 3 findings and applying fixes produces a corrected version 2 and the history shows both versions.

### Phase 6: Approval workflow, comments, audit (Tue afternoon)
Build: submit rules, reviewer decision, Review model, comments, audit log, Review queue page, status pills, approved lock.
Commits:
24. `feat(server): submit and reviewer decision with workflow rules`
25. `feat(server): comments and audit log`
26. `feat(client): submit, approve, request changes and review queue`
27. `feat(client): comments and audit tabs`
**Done when:** the full loop works across the three demo roles. Tag `v0.6` (this is the **minimum demo-ready build**).

### Phase 7: Hardening (Tue evening to Wed morning)
Build: rate limiting, zod validation, error handler, loading/empty/error states, AI toggle in settings, demo reset button, test all four sample drafts, fix bugs.
Commits:
28. `feat(server): validation, rate limiting and central error handler`
29. `feat(client): loading, empty and error states, AI mode toggle`
30. `fix: <describe each bug fixed during testing>` (one commit per fix)

### Phase 8: Docs and submission pack (Wed afternoon/evening)
Build: README, disclosures, feature list, changes-from-plan, updated PDF, final production test.
Commits:
31. `docs: readme with setup, architecture and AI disclosure`
32. `docs: completed features and changes from plan`
Tag `v1.0-round2`.

### If you fall behind: cut list (cut in this order)
1. DOCX upload and anchored comments
2. Paste-import preview polish
3. Audit trail tab (keep the logging, drop the UI)
4. Edit-suggestion (keep accept and dismiss)
**Never cut:** login/demo, knowledge base, review with cited findings, accept/dismiss, submit, approve. Those are the scored core.

---

## 13. Acceptance criteria and demo script

A judge, with no help, should be able to do this in under 5 minutes:

1. Open the live link, click **Try demo: Creator**.
2. Open *Summer launch post*, click **Run review**. See 5 or more highlighted issues, each with a cited rule or fact and a suggested fix.
3. Accept two, edit one, dismiss one (with reason). Click **Apply accepted fixes** and see version 2.
4. Re-run review, resolve remaining high findings, click **Submit for approval**.
5. Log out, click **Try demo: Reviewer**, open the queue, add a comment, **Request changes** with a note.
6. Back as creator, see the status and the note, make a change, resubmit.
7. As reviewer, **Approve**. The draft becomes read-only, with history and audit visible.
8. As admin, open Knowledge, change a fact, toggle rules-only mode and confirm reviews still work.

**Automated checks (nice to have, small):** 6 to 8 unit tests for `ruleChecks`, `verifier` and `applyFixes` (these are the pure functions and are easy to test).

---

## 14. Using AI coding tools well (vibe coding without losing control)

1. **Give context once, then stay small.** Start every session with: "Read SRS.md fully. We are building **Phase N**. Follow the data model, endpoints and file layout exactly. Do not build anything from a later phase."
2. **One phase, one session.** Ask for backend first, run it with curl/Postman, then the frontend.
3. **Pin the contracts.** If the AI changes a field name, endpoint or enum, make it match this SRS rather than updating the SRS silently.
4. **Run before you commit.** Start the app, click the thing, check the "Done when" line. Only then commit.
5. **Read the diff.** Judges can ask you to explain any part of the code. If you cannot explain it, ask the AI to explain it before committing.
6. **Keep secrets out.** `.env` in `.gitignore` from the first commit. Rotate any key that is ever committed.
7. **Prompt template per task:**
```
Context: BrandLens MVP, see SRS.md section <n>.
Task: <one concrete task, e.g. "implement verifier.js as in section 8 step 4">.
Constraints: Node 20, ES modules, Mongoose, zod validation, no new dependencies
unless needed (tell me which and why).
Output: the files changed with full code, then 3 manual test steps I can run.
```
8. **Disclose.** Record which tools generated which parts. This goes in the README.

---

## 15. Deployment checklist

- Atlas: create cluster, DB user, network access `0.0.0.0/0` (needed for Render).
- Render (server): build `npm install`, start `node src/index.js`, set all env vars, `CLIENT_ORIGIN` = Vercel URL. Free instances sleep, so open the app a few minutes before submission to wake it.
- Vercel (client): root `client`, build `npm run build`, env `VITE_API_URL` = Render URL. Add SPA rewrite so deep links work (`vercel.json` rewrite all to `/index.html`).
- Run `npm run seed` once against production (or call demo reset).
- Test **every link in an incognito window**, including the repo (must be public), the live app, and the Drive PDF.

---

## 16. Round 2 submission pack (fill in on Wednesday)

**Working project link:** `<Vercel URL>` (demo logins on the login page, no signup)
**Source repository:** `<public GitHub URL>`
**Updated project PDF:** `<Drive link, Anyone with the link: Viewer>`

**Completed features:** copy from section 2.1, marking each as done.

**Technology and implementation details:** React + Vite + Tailwind, Node/Express, MongoDB Atlas, JWT with RBAC, hybrid review pipeline (rules + grounded LLM + verifier), LLM adapter (provider and model named in README), PII masking, Vercel + Render deployment. List every library and AI tool used.

**Changes from the original plan (likely, edit to match what really happened):**
- The MVP passes all clauses and valid facts to the model instead of embedding retrieval, because the demo knowledge base is small. Retrieval moves to Round 3.
- Image and accessibility checks and the insights dashboard are deferred to Round 3 as announced.
- The outdated-fact check uses stored stale values for the MVP, with deeper claim-to-fact matching planned for Round 3.
- Authentication includes one-click demo logins so judges can test without signing up.

**Three major improvements for Round 3:**
1. **Evidence-grounded claim and fact verification:** embedding-based retrieval (Atlas vector search) to match claims to approved facts, conflict detection with confidence, and a "no supporting fact found" state.
2. **Image and accessibility checks:** image upload with WCAG contrast ratio, alt-text presence/quality, and palette/logo-usage checks.
3. **Guideline Health insights:** dashboard of recurring issue types, most-dismissed clauses, "possibly unclear guideline" flags, and trends over time.

**Contribution statement:** Sandesh Sandip Bodekar (solo): all design, frontend, backend, database, AI pipeline, testing, deployment and documentation.

---

## 17. Quick reference: enums and constants

- Roles: `admin | creator | reviewer`
- Draft status: `draft | checked | submitted | approved | changes_requested`
- Content types: `post | ad | email | document`
- Finding type: `tone | terminology | claim | fact_conflict | outdated_fact | legal | other`
- Severity: `high | medium | low`
- Decision: `pending | accepted | edited | dismissed`
- Review decision: `approved | changes_requested`
- Pipeline mode: `ai+rules | rules-only`
- Demo password: `Demo@1234`
