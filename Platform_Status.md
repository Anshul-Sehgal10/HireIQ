# HireIQ — Platform Status

## Phase 1: Foundation — ✅ Done

- JWT auth (access/refresh, rotation, blacklist), Argon2id hashing
- Google/LinkedIn OAuth (single-account-per-provider model — being replaced, see Phase 6)
- RBAC (admin/employer/candidate), 3-layer route protection
- Org CRUD, invites, join requests

## Phase 2: Jobs & Matching — ✅ Done

- Job CRUD/publish/close, resume upload (presigned S3/local)
- LLM extraction (Gemini) + embeddings for resumes & JDs
- Cosine similarity matching w/ cross-domain penalty
- Paginated candidate feed w/ filters
- Monthly override quota system

## Phase 3: Scenario Engine — ✅ Done

- LangGraph generate→critique→revise question pipeline
- Scenario evaluation + anti-gaming signal capture
- Full candidate flow: start/poll/submit/override
- Employer test-preview endpoint

## Phase 4: Pipeline — ✅ Mostly done

- Shortlist/reject, bulk stage advance, per-job broadcast/direct chat
- Ranked candidate endpoint (raw scores, unblended — see Phase 7)
- ❌ WebSocket live push (currently poll-based)
- ❌ Employer/admin analytics aggregates

## Phase 5: Billing/CI/CD — ❌ Not started

- Razorpay: nothing built
- `TokenUsageLog` table exists but nothing writes to it — no LLM call site logs cost yet
- Docker/CI/CD: not addressed
- Rate limiting: none

## Phase 6: Auth Refactor — 🆕 Planned (brainstormed, not built)

- [ ] `oauth_accounts` table (multi-provider per user)
- [ ] Migrate off `users.oauth_provider` / `oauth_provider_id`
- [ ] Rewrite `upsert_oauth_user` per 3-step login algorithm
- [ ] "Connect provider" flow for logged-in users (separate from login OAuth flow)
- [ ] Unlink endpoint w/ lockout protection
- [ ] Frontend: profile page shows list of linked providers (frontend-agent item, later)

## Phase 7: Admin Moderation — 🆕 Planned

- [ ] Add `BLOCKED` to `VerificationStatus`; org verify/reject/block/unblock endpoints
- [ ] Cascade: blocking an org closes its published jobs
- [ ] Gate `publish_job` on org being `VERIFIED`
- [ ] User block/unblock endpoints (reuse `is_active`)
- [ ] Fix dead-end: rejected org owner currently can't create a new org — needs resolution
- [ ] Admin org/user list endpoints (unblocks the Admin Dashboard, already flagged as blocked on this)

## Phase 8: Org Join Code — 🆕 Planned

- [ ] `Organization.join_code` (regenerable, unique)
- [ ] `POST /orgs/join-by-code` (reuses existing join-request flow)
- [ ] `POST /orgs/mine/regenerate-code`

## Phase 9: Org Chat + Candidate Visibility + Composite Ranking — 🆕 Planned

- [ ] `org_messages` table + endpoints (team-wide chat, distinct from per-job pipeline chat)
- [ ] Employer-facing candidate resume detail endpoint (locked version, scoped to application)
- [ ] Employer-facing resume download-URL endpoint
- [ ] Composite score (match + scenario) computed in ranked endpoint, sortable
- [ ] Confirm: notification via existing dashboard status badges is sufficient (no new table needed) unless you want unread counts later

## Phase 10: Multi-Role API Access — 🆕 Planned

- [ ] Audit existing routes for missing EmployerOrAdmin-style combos
- [ ] Shared ownership-or-admin helper (shared with Phase 7)

## Phase 11: Job Lifecycle & Deadlines — 🆕 Planned

- [ ] `applications_close_at` on JobPosting
- [ ] Lazy + explicit ranking-finalization trigger (no scheduler infra)
- [ ] Tie-break by applied_at ASC on equal composite score
- [ ] Decide: hard cutoff vs override grace period at deadline
- [ ] Bulk shortlist endpoint (explicit IDs or top_n), partial-success semantics
- [ ] Expose paste_detected/tab_switches on ranked endpoint + opt-in filters (never auto-reject)

## Phase 12: Company Page & JD Presentation — 🆕 Planned

- [ ] Public org profile endpoint + Organization.about/logo_url
- [ ] LLM-generated markdown formatted_summary on JD extraction
- [ ] Separate employer-edited override from LLM-generated version (avoid reprocess clobbering)

## Phase 13: Candidate Profile Expansion — 🆕 Planned

- [ ] Manually-editable experience/education/projects/links (separate from LLM resume extraction, not overwritten by reprocess)
- [ ] Decide: do manual edits feed back into embedding/matching (separate sub-scope)
- [ ] JobPosting.job_type enum (internship/full_time/part_time/contract) + feed filter

## Known Cross-Cutting Gaps (carried over)

- No token-cost tracking despite the landing page pitching it
- No admin analytics aggregate endpoint
