# HireIQ — AI-Native Hiring Platform
> *Confidential Product Brief*

---

## The Core Problem

Modern hiring is broken in both directions.

**For employers:** Candidates use AI to generate polished resumes and pass text-based screenings, making it impossible to distinguish genuine talent from well-prompted responses. Recruiters waste hours manually screening hundreds of applications, most of which are irrelevant, and then rely on mass emails and spreadsheets to manage the pipeline.

**For candidates:** Job boards show everything regardless of fit, leading to mass-applying, instant rejections with no feedback, and zero visibility into where they stand in the process.

HireIQ solves both sides — a platform that pre-qualifies candidates semantically before they even apply, tests genuine thinking under pressure, and replaces the entire email-based hiring pipeline with a real-time, role-aware communication layer.

---

## What Makes It Stand Out

### The Behavioral Scenario Engine
The defining feature. Because any candidate can polish a resume with ChatGPT, resumes no longer signal real ability. HireIQ counters this with an **interactive, time-boxed behavioral scenario** generated dynamically from the Job Description.

- When a candidate applies, the LLM generates a role-specific scenario question derived from the actual JD (not a generic puzzle — a real situational challenge relevant to the role)
- The candidate enters an **isolated, fullscreen test environment** with a countdown timer, preventing web searches or AI assistance
- The answer is evaluated not for correctness, but for **thinking process, structure, and alignment with the role's requirements**
- The employer receives the raw answer alongside an **AI-generated summary** explaining how the response reflects the candidate's reasoning style and whether it aligns with the scenario
- This is **optional, employer-controlled** — each employer decides whether to enable it per job posting
- The scenario score contributes to the candidate's **overall match rank** but is never the sole rejection criterion

This is the feature that makes HireIQ defensible. It cannot be gamed by AI-generated text because the response is time-constrained, contextual, and evaluated for *process*, not polish.

---

## Platform Roles

### Admin
- Full platform oversight: manage employers, candidates, job postings, and flagged content
- Access to platform-wide analytics: token usage, revenue, active pipelines, rejection rates
- Can suspend employers or candidates, resolve disputes, and manage subscription tiers
- Configures platform-wide LLM settings and cost thresholds

### Employer
- Requires **identity + business verification** before posting (prevents fake job postings)
- Creates job openings with JD, required skills, hiring count, compensation range, and work mode
- Chooses whether to enable the Behavioral Scenario Engine per posting
- Sees a **ranked candidate list** with resume match score, scenario score, and an AI-generated one-line summary per candidate
- Manages the hiring pipeline via a **broadcast channel** per job (described below)
- Pays per usage: platform fee + live LLM token cost displayed on their dashboard

### Candidate
- Uploads resume once; a semantic embedding is created and stored
- Resume is auto-matched against all job postings to generate a **personalized job feed** (a marketing person sees marketing roles; a backend engineer sees engineering roles — not a generic list)
- Can apply with filters: remote/onsite/hybrid, job level, location, company size, expected CTC
- Subject to a **monthly application cap** (e.g., 10 low-match applications per month) — detailed below
- Tracks their entire application status in-platform; no dependency on email

---

## Key Features

### 1. Semantic Resume–JD Matching (Pre-Application Gate)
Before a candidate can submit an application, their resume embedding is compared against the JD embedding using cosine similarity.

- **High match:** Application proceeds normally
- **Low match:** The candidate is shown a clear, respectful signal — *"Your profile is not a strong match for this role based on your skills and experience"* — and the application is soft-blocked
- This saves candidates from guaranteed rejections and saves employers from irrelevant applications
- Candidates are not hard-blocked from applying to low-match jobs entirely — they receive a **monthly quota** (e.g., 10 override applications/month) for cases where they believe the match score is wrong
- This quota resets monthly and can be expanded via subscription

**Why this matters:** It shifts the platform from a mass-apply model to an intentional one. Candidates who do get through to employers are genuinely relevant — reducing recruiter fatigue dramatically.

### 2. Subscription & Usage Model
Two-sided monetization: candidates pay for access, employers pay for usage.

**Candidate tiers:**
| Tier | Monthly Override Apps | Resume Boosts | Price |
|---|---|---|---|
| Free | 10 | — | ₹0 |
| Pro | 30 | 5 | ₹299/mo |
| Premium | Unlimited | Unlimited | ₹799/mo |

**Employer model:**
- Platform fee per active job posting
- **Live LLM token usage dashboard** — employers see exactly how many tokens their job's scenario evaluations consumed, billed transparently
- Subscription tier determines how many active job postings they can run simultaneously
- Verification fee (one-time) to prevent fraudulent postings

### 3. Pipeline Chat — Broadcast Channels
Once resume screening is complete, selected candidates are added to a **job-specific broadcast channel** — a real-time in-platform messaging space.

- Employers post updates to all candidates simultaneously (assessment instructions, interview schedules, next steps)
- Candidates see their own application status live — no waiting for emails that might go to spam
- As candidates are rejected at any stage, they are **automatically removed from the channel** and notified in-platform with a brief reason
- Employers can also message individual candidates privately within the same interface
- This eliminates the recruiter's dependency on Gmail/Outlook for pipeline communication entirely

**Stages supported in the channel:**
1. Resume shortlisted → added to channel
2. Assessment sent (links, instructions broadcast to all)
3. Interview scheduled (individual messages with time slots)
4. Offer / Rejection (automated removal + notification)

### 4. Personalized Job Feed
The candidate's resume embedding is matched against all active job postings at login/refresh, generating a ranked, personalized feed.

- Jobs are ranked by semantic similarity score
- Candidate can additionally filter by: work mode, job level (fresher / 1–3 yrs / 3–5 yrs / senior), location, industry, company size, expected CTC range
- Jobs the candidate is already unqualified for (below a minimum threshold) are hidden by default, with an option to reveal them
- This makes the job discovery experience feel like it was built for them — not a generic board

### 5. Employer Candidate Dashboard
For each job posting, employers see a ranked list of applicants:

- **Match score** (resume–JD semantic similarity, percentile rank among applicants)
- **Scenario score + AI summary** (if the Behavioral Scenario Engine was enabled)
- **One-line AI-generated candidate summary**: *"Strong backend background with 3 years in Python; scenario response showed structured thinking but limited leadership framing"*
- Ability to shortlist, reject, or hold candidates with one click
- Filter candidates by score range, scenario completion, application date

---

## Improvements & Additions Worth Building

### Anti-Gaming for the Scenario Engine
The time limit alone isn't sufficient. Add:
- **Clipboard paste detection** (disable paste in the scenario input field)
- **Tab-switch / focus-loss detection** — if the candidate switches tabs, a warning is logged and shown to the employer
- **Keystroke cadence analysis** — typed responses have natural rhythm; pasted AI text typically arrives all at once or in large bursts. Flag anomalies.
- These don't auto-reject — they surface as signals to the employer, preserving fairness

### Candidate Feedback Loop
Currently candidates apply and wait. Give them more:
- After rejection at resume stage, show *which skills* caused the low match (e.g., *"This role required React and GraphQL — your resume didn't reflect these"*)
- After scenario evaluation, give the candidate a private copy of the AI summary of their own answer (delayed by 24h to prevent gaming)
- This makes the platform valuable even when candidates don't get the job — they learn something

### Employer Analytics
Beyond per-job pipeline management, give employers a dashboard:
- **Pipeline funnel**: applications → resume pass → scenario complete → shortlisted → hired
- **Time-to-hire** tracking
- **Token cost per hire** (total LLM cost across all evaluations for a role, divided by hires)
- Benchmark comparisons: *"Your software engineer role received 40% fewer qualified applicants than similar postings this month"*

### Resume Version Control
Candidates often update their resume mid-application. Handle this explicitly:
- When a candidate updates their resume, re-run matching for all active applications
- Notify the candidate if an update improved or worsened a match score
- Lock the resume version used for each application at submission time (so employers see the resume that was actually matched)

### Fraud & Quality Controls
- **Employer verification:** Business email domain check + LinkedIn company page match + manual review queue for edge cases
- **Job posting quality score:** LLM reviews JD completeness before publishing — flags vague postings like *"good communication skills required"* with no technical requirements
- **Candidate resume validation:** Flag resumes that appear AI-generated with near-identical phrasing to common ChatGPT resume templates (not auto-reject, just a soft signal)

---

## Tech Architecture Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Vercel AI SDK for streaming |
| Backend | FastAPI (async), SQLAlchemy + Alembic, Pydantic v2 |
| Auth | JWT (access + refresh rotation) + OAuth2 (Google/LinkedIn) |
| RBAC | Centralized FastAPI dependency, role stored in Postgres |
| Agent Orchestration | LangGraph — scenario generation, resume evaluation, summary generation |
| RAG / Embeddings | LangChain + OpenAI embeddings, Qdrant for vector storage |
| Background Jobs | ARQ (Redis-backed) for resume processing, scenario evaluation |
| Real-time | WebSockets (FastAPI) for broadcast channels + SSE for pipeline status |
| Storage | PostgreSQL (users, jobs, pipeline), Redis (sessions, job queues), S3/R2 (resumes) |
| Payments | Razorpay (India) or Stripe |
| Monitoring | Token usage tracked per employer per job, stored in Postgres |

---

## What This Demonstrates to an Interviewer

- **LangGraph** used for a real multi-step agentic flow (JD analysis → scenario generation → answer evaluation → summary generation) — not a chatbot wrapper
- **RAG** used for semantic matching, not document Q&A — a more sophisticated application
- **Multi-tenant RBAC** with genuinely different UX per role, enforced at API level
- **Real-time systems** (WebSocket broadcast channels) alongside async background pipelines
- **Product thinking**: subscription model, fraud controls, candidate feedback, employer analytics — shows you ship products, not just features
- **Monetization design**: live token cost visibility for employers is a real SaaS pattern (like AWS cost explorer) that shows commercial maturity

