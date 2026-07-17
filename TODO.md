# Todo

## Bugs

### Backend

- [] Can't apply for job until scenario (if enabled) is completed

### Frontend

- [] Logout redirects on home page not login
- [Later] The filters in candidate job feed dosen't update with resume change, can fix it when we redesign the page

## Features

### Backend

- [Later] Local user → can link a Google/LinkedIn account
- [We brainstorm later] run splade search on both resume and jd, then get the top matching keywords, send them to ai and get the score
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
