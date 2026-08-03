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

- [ ] Change the color of sidebar collapse button, remove the theme option in collapsed sidebar, also when we hover to closed sidebar's open button, it opens the sidebar because of hover and we have to move again to pin the sidebar
- [ ] Make the sidebar job scenario checkbox in employer form a ticked by default
- [ ] Rejected label should be shown in red in job feeb
- [ ] Applied jobs on the feed should be shown at last
- [ ] Employer can't see the candidate's response or response remark by llm
- [ ] Add proper logging across the whole app
- [ ] Replace errors by toast in frontend
- [ ] Need an organization page that contain organization info and employees and all their active jobs for candidates
- [ ] The employers can set the match threshold for shortlisting resumes, and can change it anytime until the job is closed
- [ ] Resume pdf preview for candidate in manage resumes and for employers in job pipeline
- [ ] New Scenario page, that tracks tab/focus switch, allows 1 if a genuine mistake and rejects the candidate on further attempts, can't copy the question, pasting not allowed, fullscreen mode
- [ ] Optimize the langgraph for error prone situations

- [ ] Restructure the file by feature not type ([reference](https://chatgpt.com/c/6a6705f4-59bc-83ee-be9c-9b95691bae4a))
- [ ] Learn in depth about redis, pub/sub for live updates and task scheduler for time based taske like monthly overrirde resets

## Bugs

### Backend

Backend agent fix these bugs, Frontend agents report backend bugs here:

### Frontend

Frontend agent fix these bugs, Backend agents report frontend bugs here:

## Features

### Backend-

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
- [x] IMPLEMENTED (pending migration + testing) — Scenario question
      swap-on-violation system, replaces the earlier auto-reject design.
      backend/app/db/models/scenario.py — ScenarioQuestion gains
      question_pool (JSONB) and violation_count (int) columns; migration
      needed (see chat for exact upgrade/downgrade).
      backend/app/services/scenario_generation.py — new
      generate_scenario_question_pool(job, count=3), runs 3 concurrent
      generate->critique->revise pipelines.
      backend/app/repositories/scenario_repo.py — new
      create_scenario_question_with_pool, swap_question,
      register_violation_without_swap.
      backend/app/router/routes/scenario.py — start_scenario now generates
      a 3-question pool instead of 1; new POST
      /applications/{id}/scenario/violation endpoint (body: {reason:
      "tab_switch"|"paste"}) swaps in a fresh question from the pool on
      each violation, timer never resets. After 2 swaps (pool exhausted),
      a 3rd violation force-rejects the application.
      Cost note: scenario start now costs ~3x the LLM calls it used to
      (one full generate/critique/revise cycle per pool question) — flagging
      since token usage still isn't logged to token_usage_logs anywhere.

### Frontend-

Frontend agent implement these features, Backend agents report frontend features here:

- [ ] NEW — Wire up the scenario page to the swap-on-violation system
      Component: frontend/app/(app)/candidate/scenario/[applicationId]/page.tsx
      Replaces the earlier "lock down + auto-reject" plan — implementation is
      now the "swap the question, keep the timer running" design instead.
      Requirements:
        - On visibilitychange (tab switch/blur) and on paste into the
          answer textarea: call POST
          /applications/{id}/scenario/violation with
          {reason: "tab_switch"} or {reason: "paste"}.
        - Response shape: {violation_count, rejected, new_question_text,
          time_remaining_seconds}.
        - If rejected: true → immediately end the test, show a terminal
          "your application was not submitted — the test was ended due to
          repeated activity outside the test window" screen. No further
          typing/submission possible.
        - If rejected: false and new_question_text is present → replace
          the displayed question text with new_question_text, CLEAR the
          answer textarea (they're now answering a different question),
          and show a brief non-blocking notice ("The question has changed
          — your previous progress on this answer no longer applies").
          Do NOT reset/pause the countdown timer — it keeps running
          across swaps, that's the whole point.
        - If new_question_text is null and rejected is false (edge case:
          time_remaining_seconds was already 0 when the violation fired) →
          no-op, let the existing timeout-triggers-submit logic handle it
          as normal.
        - Question text: still block copy/oncontextmenu client-side
          (user-select: none, preventDefault on oncopy) as a light deterrent
          — this is separate from the paste-on-answer violation reporting.
        - Fullscreen API on entry is still worth keeping as a nudge
          (reduces accidental/casual tab-switching) even though it's no
          longer load-bearing for the anti-cheat mechanism itself.
      Priority: High

## Any Note by the agent

### Note By Frontend Agent (if any)

### Note By Backend Agent (if any)
