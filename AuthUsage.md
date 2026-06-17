# Auth usage in the app

**On protecting frontend routes** — you already have the right pieces, you just need a consistent pattern as you scale. Here's the complete picture:

**Backend is simple** — just use the aliases you already have:

```python
# In any new route file:
from app.core.dependencies import EmployerUser, CandidateUser, AdminUser, CurrentUser

@router.get("/applications")
async def list_applications(user: CandidateUser, db: Annotated[AsyncSession, Depends(get_db)]):
    ...

@router.get("/org/settings")  
async def org_settings(user: EmployerUser, db: Annotated[AsyncSession, Depends(get_db)]):
    ...
```

One alias = one line of protection. You're already doing this correctly in `jobs.py`.

**Frontend has three layers**, and knowing which to use where is the key decision:

**Layer 1 — Middleware (`middleware.ts`):** Already handles all `/dashboard/*` routes. As you add new protected route groups, just extend `ROLE_ROUTES`:

```typescript
const ROLE_ROUTES: Record<string, string[]> = {
  "/dashboard/admin":     ["admin"],
  "/dashboard/employer":  ["employer", "admin"],
  "/dashboard/candidate": ["candidate", "admin"],
  // Add new protected roots here as you build them:
  "/onboarding":          ["employer", "candidate"],
  "/apply":               ["candidate"],
};
```

The middleware handles entire subtrees — `/dashboard/employer` covers `/dashboard/employer/jobs`, `/dashboard/employer/applications`, everything under it. You never need to touch middleware again for new pages under existing route groups.

**Layer 2 — `RoleGuard` component:** Use this for pages where the route is shared but content is role-specific, or as a fallback when you want a client-side double-check. You already have it built, just unwrap the commented-out code in `employer/jobs/page.tsx`:

```typescript
export default function EmployerJobsPage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <JobsContent />
    </RoleGuard>
  );
}
```

**Layer 3 — `useAuth` hook:** Use this inside components when you need the user's identity to conditionally render UI, not for blocking access:

```typescript
function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav>
      {user?.role === "employer" && <Link href="/dashboard/employer/jobs">Jobs</Link>}
      {user?.role === "candidate" && <Link href="/dashboard/candidate">Feed</Link>}
      <button onClick={logout}>Sign out</button>
    </nav>
  );
}
```

**The decision rule for each new page:**

``` text
New page under /dashboard/*?
  → Middleware already covers it. Done.

New page outside /dashboard/* that needs auth?
  → Add the route to ROLE_ROUTES in middleware.ts

Page needs to show different UI per role (not block access)?
  → useAuth() hook inside the component

Server component that needs user identity?
  → Read the access_token cookie directly like candidate/page.tsx does
```

The backend is always the real security boundary — the frontend layers are purely UX (fast redirects, no flash of wrong content). Even if someone bypasses all three frontend layers, the FastAPI `require_role` dependency rejects the API call.
