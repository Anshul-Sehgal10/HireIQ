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

- [ ] when candidate use override after submitting scenario, it should bring him back to dashboard or say applied or used override, instead it says 0% Meets the bar for this role Needed 50% to pass automatically.
- [ ] Change the color of sidebar collapse button, remove the theme option in collapsed sidebar, also when we hover to closed sidebar's open button, it opens the sidebar because of hover and we have to move again to pin the sidebar
- [ ] Make the sidebar job scenario checkbox in employer form a ticked by default
- [ ] Rejected label should be shown in red in job feeb - should we even show the applied jobs in job feed?
- [ ] Turn org chat into live socket chat, as we will need it later for jobchat as well
- [ ] Restructure the file by feature not type ([reference](https://chatgpt.com/c/6a6705f4-59bc-83ee-be9c-9b95691bae4a))
- [ ] Learn in depth about redis, pub/sub for live updates and task scheduler for time based taske like monthly overrirde resets

## Bugs

### Backend

Backend agent fix these bugs, Frontend agents report backend bugs here:

### Frontend

Frontend agent fix these bugs, Backend agents report frontend bugs here:

Issue: Scenario override result shows stale data

Component: frontend/app/(app)/candidate/scenario/[applicationId]/page.tsx
Steps: Submit scenario below threshold → click "Use override" → confirmOverride() fires
Expected: After a successful override, the user should see confirmation that their application moved forward, not the original below-threshold result screen.
Actual: confirmOverride() calls the override endpoint (which correctly returns meets_threshold: true) but never uses that response — it just does router.push("/candidate/dashboard") on success. If a stale result state renders anywhere in between, it'll show the pre-override 0%/failed data.
Suggested fix: Either update local result state with the override response before navigating, or trust the redirect is instant and confirm there's no flash of the old done stage — worth a quick manual test to isolate exactly where the stale render happens.
Priority: Medium

## Features

### Backend

Backend agent implement these features, Frontend agents report backend features here:

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

- [in prog] Title: New WebSocket endpoints for team chat + pipeline chat — UI needed
      Affected: /employer/team-chat, /employer/jobs/[jobId]/pipeline, /candidate/pipeline/[applicationId]
      Priority: High

New WS endpoints and protocol are documented in the TODO.md block above — please build the Teams-style UI (presence list, typing indicator, live message stream) against those.
Important distinction to render correctly: the pipeline socket now emits two different frame types — "message" (persisted, shows in history) and "activity" (ephemeral shortlist notices, should render as a transient toast/banner, not a permanent chat bubble, and should not be added to whatever message array you keep in state for history purposes).
Existing REST GET endpoints (/orgs/mine/messages/, /jobs/{job_id}/pipeline/messages, /applications/{application_id}/pipeline/messages) are unchanged — keep using those for initial load; sockets are additive for live updates.
No candidate-side pipeline chat input needed — that socket is receive-only by design (matches existing REST, which never had a candidate POST route either).

## Any Note by the agent

### Note By Frontend Agent (if any)

### Note By Backend Agent (if any)

**WebSocket chat infrastructure added** (team chat + pipeline chat), plus a behavior change to shortlisting:

New WS endpoints (all under `/api/v1`, so e.g. `ws://localhost:8000/api/v1/ws/orgs/mine/chat`):

- `WS /ws/orgs/mine/chat` — team chat. Employer/admin only, resolves org from the caller automatically.
- `WS /ws/jobs/{job_id}/pipeline/chat` — pipeline chat, employer side. Full read/write.
- `WS /ws/applications/{application_id}/pipeline/chat` — pipeline chat, candidate side. **Read-only** (receives live pushes only — there's still no candidate POST for pipeline messages, matches the existing REST design).

**Auth:** no separate WS login step needed — the browser sends the existing `access_token` cookie automatically on the WS handshake. Just `new WebSocket(url)` with the browser already logged in; no manual token attachment required for browser clients.

**Protocol** — every frame is JSON with a `type` field:

Org chat client → server: `{"type":"message","content":"..."}`, `{"type":"typing_start"}`, `{"type":"typing_stop"}`
Org chat server → client: `{"type":"message","data":OrgMessageResponse}`, `{"type":"presence","online_users":[{user_id,user_name,role}]}`, `{"type":"typing",user_id,user_name,is_typing}`, `{"type":"error","detail"}`

Pipeline chat (employer) client → server: `{"type":"message","content":"...","message_type":"broadcast"|"direct","recipient_application_id":"..."?}`, `{"type":"typing_start"}`, `{"type":"typing_stop"}`
Pipeline chat server → client (both employer + candidate sockets): `{"type":"message","data":ChannelMessageResponse}`, `{"type":"activity","message":"..."}`, `{"type":"typing",...}` (employer socket only), `{"type":"error","detail"}`

**Still use the existing REST GET endpoints for initial history on page load** (`GET /orgs/mine/messages/`, `GET /jobs/{job_id}/pipeline/messages`, `GET /applications/{application_id}/pipeline/messages`) — the sockets are for live updates only, not history. REST POST for org/pipeline messages still works too and now also pushes live to connected sockets (so it's safe to keep as a fallback for non-JS-heavy flows, but the WS `"message"` frame is the primary path going forward).

**Behavior change — shortlist no longer posts a persisted chat message.** Per your request, shortlisting a candidate now pushes an ephemeral `{"type":"activity","message":"X has been shortlisted."}` WS event instead of writing a SYSTEM row to `channel_messages`. This means:

- Live viewers see a "X has been shortlisted" toast/notice in real time.
- It does NOT appear in the message history returned by `GET /jobs/{job_id}/pipeline/messages` — reload the page and it's gone, by design.
- Reject and stage-advance still write real, persisted SYSTEM messages (those remain visible in history) — only the high-frequency single-shortlist case was silenced.

**Frontend work needed (your lane):**

1. Team chat UI — Teams-style: message list, composer, online-users list from `presence` frames, typing indicator strip from `typing` frames (debounce sending `typing_start`/`typing_stop` on keystroke, e.g. 2s idle → stop).
2. Pipeline chat UI — same pattern but note the `activity` frame type needs a different, transient rendering (toast/banner, not a chat bubble) since it's not part of persisted history.
3. Connect socket on mount, close on unmount; reconnect-with-backoff on drop recommended (no reconnection logic exists server-side — plain accept/reject per connection).
4. Origin-based auth means this only works when the frontend is served from an origin matching `FRONTEND_URL`/`localhost:3000` — confirm your dev setup matches before testing (or ask backend to add another allowed origin).

**Known limitation (flagged, not fixed):** in-memory connection manager is single-process — will need a Redis pub/sub layer (or similar) before this can run behind multiple backend workers/replicas. Deferred, tracked as future Phase 5 infra work.
