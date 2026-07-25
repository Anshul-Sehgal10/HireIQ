# Todo

## Important Note

Division of labor clarification (per user instruction): the backend agent
owns all business logic and page creation, including functional frontend
pages that call new APIs. The frontend agent's role is visual redesign of
existing pages only — no new pages, no new business logic, no guessing at
requirements. TODO.md is not edited directly by either agent;
each agent gives the user the content to paste in.

## My Todos

The Todos for the user, ai model ignore this section

- [ ] test the pipeline flow - can't shortlist candidates
- [ ] The candidate cannot withdraw his application
- [ ] Scenario test should start right after you click "Start scenario" right now it just takes you to job feed then you click the application again and proceed to the test
- [ ] Claude's design - Design decision — org unblock and members: keeping it manual, as originally implemented. Unblocking an org restores VERIFIED only; members who were auto-blocked stay blocked until an admin explicitly unblocks them (via the Members modal or Users tab). Reasoning: auto-unblocking members would silently restore access for someone who may have been individually flagged for a separate reason, or who joined after the org-level block for an unrelated cause — the admin should make that call per-person, same as the existing "jobs stay closed after org unblock, deliberate republish required" pattern elsewhere in the app. No code change needed here; this was already the behavior, just documenting the reasoning since it was an open question.

      What i think - When we block users independently, remove them from the org/any applied job as well, so they are totally isolated and prevents breaking the system, But when we block an org, the members stay in the org but gets blocked, and when we unblock the org, the members gets unblocked as well.
- [ ] Turn org chat into live socket chat, as we will need it later for jobchat as well, or should we use http polling?
- [ ] Employers can't join orgs by invite link, discard the link and org id system entirely, unnecessary complexity, they need code to join the org
- [ ] Per job candidate count visible on job posting page to employers

## Bugs

### Backend

Backend agent fix these bugs, Frontend agents report backend bugs here:

### Frontend

Frontend agent fix these bugs, Backend agents report frontend bugs here:

## Features

### Backend

Backend agent implement these features, Frontend agents report backend features here:

- [ ] Make it so the candidate can't apply for job until scenario (if enabled) is completed.
- [ ] Admin platform-analytics endpoint — needed to build out the real Admin
      Control Center per the PRD (org verification queue, token usage by org,
      platform-wide pipeline funnel, rejection rates). No aggregate admin
      endpoint exists yet; admin dashboard currently only shows session info.
- [ ] (Nice-to-have) Employer aggregate stats endpoint — dashboard currently
      computes "applicants in pipeline" / "avg match score" by fanning out
      GET /applications/job/{id} across every published job client-side.
      Works fine at small scale but a single aggregate endpoint would be
      cheaper if org job counts grow.

### Frontend

Frontend agent implement these features, Backend agents report frontend features here:

- [ ] Ranked candidate dashboard UI — GET /jobs/{job_id}/candidates/ranked
      returns each applicant's resume match_score and scenario_score as
      separate fields (composite scoring is intentionally deferred — show
      both raw, don't blend them into one number). Wire Shortlist/Reject
      buttons to POST /jobs/{job_id}/pipeline/shortlist/{application_id}
      and POST /jobs/{job_id}/pipeline/reject/{application_id} (204, no body).
- [ ] Pipeline channel chat UI (per job) — employer: GET/POST
      /jobs/{job_id}/pipeline/messages (message_type: "broadcast" | "direct";
      "system" is rejected with 400 if an employer tries to send it — those
      are server-generated only). GET /jobs/{job_id}/pipeline/members for
      the active roster. Candidate side is read-only: GET
      /applications/{application_id}/pipeline/messages — server already
      filters to broadcast+system+their own direct messages, no client
      filtering needed.
- [ ] Stage advance control — POST /jobs/{job_id}/pipeline/advance, body
      {stage: "shortlisted"|"assessment"|"interview"|"offer"|"closed"}.
      Bulk-moves every active pipeline member's application status and
      auto-posts a SYSTEM broadcast message — no per-candidate stage field
      needed in the UI, just a single control for the whole channel.
- Note: no WebSocket/live-push yet, this is poll-based
  (GET .../pipeline/messages) for now — live push is a planned
  follow-up once this UI exists.
- A minimal, unstyled backend-test harness exists at /employer/pipeline-test
  and /candidate/pipeline-test (not linked from nav) if useful as a
  reference for the request/response shapes while building the real UI.
  Feel free to ignore/replace entirely.

## Any Note by the agent

### Note By Frontend Agent (if any)

Backend change made this round (small, additive — flagging per project protocol even though the user explicitly authorized it):

- `backend/app/db/models/job.py`: added a `role_summary` @property on `JobPosting` that reads `parsed_data.get("role_summary")` — returns None if extraction hasn't run. No column, migration, or business logic touched.
- `backend/app/schemas/job.py`: added `role_summary: Optional[str] = None` to `JobResponse`. Every existing route returning `JobResponse`/`JobFeedResponse` now includes it automatically via `from_attributes` — no route code changed.
- Reason: job feed cards were showing the full raw JD text; now show the LLM's short extracted summary instead, falling back client-side to a truncated description if `role_summary` is null (unprocessed job).
- Backend agent: please sanity-check this doesn't conflict with anything you have in flight on `JobPosting`/`JobResponse`.

### Note By Backend Agent (if any)

Phase 7 (Admin Moderation) implemented — all 6 items closed:

- `VerificationStatus.BLOCKED` added (needs `alembic upgrade head` — migration
  file content given to user in chat, not auto-applied since I don't have
  repo/DB access in this environment).
- New endpoints, admin-only (`AdminUser` dependency):
  - `GET  /admin/orgs` — paginated, filter by `verification_status` + `q`,
    returns member_count/published_job_count/owner_email per org
  - `POST /admin/orgs/{org_id}/verify|reject|block|unblock` — body: `{reason?: string}`
  - `GET  /admin/users` — paginated, filter by `role`/`is_active`/`q`
  - `POST /admin/users/{user_id}/block|unblock` — body: `{reason?: string}`
- Blocking an org (or rejecting a previously-verified one) auto-closes all
  its published jobs. Unblocking does NOT reopen them — deliberate
  republish required (same pattern as other soft-state changes in the app).
- `publish_job` now 403s unless `org.verification_status == VERIFIED`. This
  also applies to the "Reopen" button on closed jobs — same endpoint.
- Fixed the rejected-org dead end: an org owner (or any member) whose org
  is `REJECTED` can now create/request a new org; their old membership is
  silently removed first.
- `AuditLog` (existed, unused) now gets a row on every moderation action.

**Frontend work needed to surface this (not done — visual/UI is frontend's
lane per project split):**

- Admin Dashboard: replace the "coming soon" TODO card with real org/user
  tables backed by `GET /admin/orgs` and `GET /admin/users`, with
  verify/reject/block/unblock action buttons calling the new POST endpoints.
- Employer-facing: org page (`/employer/organization`) should show a clear
  banner when `verification_status` is `pending`/`rejected`/`blocked`,
  explaining what it means (especially that `publish` is now blocked
  until verified, and that a rejected org owner can start a new org).
- Job posting flow: `publish`/`reopen` can now fail with 403 + a specific
  message if the org isn't verified — surface that error instead of a
  generic failure toast.
