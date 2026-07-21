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

- [Done] make the pipeline_services file in the backend
- [ ] test the pipeline flow
- [ ] The candidate cannot withdraw his application
- [ ] Scenario test should start right after you click "Start scenario" right now it jsut takes you to job feed then you click the application again and proceed to the test

## Bugs

### Backend

Backend agent fix these bugs, Frontend agents report backend bugs here:

### Frontend

Frontend agent fix these bugs, Backend agents report frontend bugs here:

- [ ] Logout redirects on home page not login

## Features

### Backend

Backend agent implement these features, Frontend agents report backend features here:

- [Later] Local user → can link a Google/LinkedIn account
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

### Note By Frontend Agent (if any)

Backend change made this round (small, additive — flagging per project protocol even though the user explicitly authorized it):
- `backend/app/db/models/job.py`: added a `role_summary` @property on `JobPosting` that reads `parsed_data.get("role_summary")` — returns None if extraction hasn't run. No column, migration, or business logic touched.
- `backend/app/schemas/job.py`: added `role_summary: Optional[str] = None` to `JobResponse`. Every existing route returning `JobResponse`/`JobFeedResponse` now includes it automatically via `from_attributes` — no route code changed.
- Reason: job feed cards were showing the full raw JD text; now show the LLM's short extracted summary instead, falling back client-side to a truncated description if `role_summary` is null (unprocessed job).
- Backend agent: please sanity-check this doesn't conflict with anything you have in flight on `JobPosting`/`JobResponse`.



### Note By Backend Agent (if any)

Pipeline feature (ranked dashboard + channel chat) is implemented:

- Employer: /employer/jobs/{jobId}/pipeline — ranked candidates table
  (resume match_score + scenario_score shown separately, composite scoring
  still deferred per backlog), shortlist/reject actions, stage-advance
  control, and channel chat (broadcast/direct).
- Candidate: /candidate/pipeline/{applicationId} — read-only message view.
- Linked in from EmployerJobDetailModal ("Pipeline" button) and the
  candidate dashboard (shown once an application reaches
  shortlisted/assessment/interview/offer).

- These are functional, minimally-styled pages. Frontend agent: feel free to
restyle to match the rest of the app (Card/Button/PageHeader conventions,
etc.) but do not change the data flow, add new routes, or alter the
request/response handling — ping the backend agent first if something
seems to need new logic.

- No WebSocket/live-push yet — messages are poll/refresh-based
(re-fetch on send). That's a planned follow-up backend increment.

- Patched candidate/jobs/page.tsx and lib/api.ts (backend agent) to fix a stale-response race condition — rapid filter changes could have an older response overwrite a newer one, making filters appear broken. Added a request-sequence guard + debounced text/salary/location inputs + cache: "no-store". No backend changes were needed this round; /jobs/feed filtering contract is confirmed correct via direct curl testing.
