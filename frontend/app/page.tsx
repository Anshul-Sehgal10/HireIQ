import Link from "next/link";
import {
  Sparkles,
  Timer,
  Target,
  MessagesSquare,
  Gauge,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-lg font-bold tracking-tight">HireIQ</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#scenario-engine" className="hover:text-foreground transition-colors">
              Scenario Engine
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#for-employers" className="hover:text-foreground transition-colors">
              For employers
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="hidden sm:inline-flex h-9 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link href="/auth/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero — leads with the Scenario Engine                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center"
        >
          <div className="h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles size={12} />
              The Behavioral Scenario Engine
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              A resume can be written by ChatGPT.
              <br />
              <span className="text-primary">A timed, live scenario can't.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              Every applicant answers a role-specific scenario question, generated fresh from the
              job description, inside a locked, time-boxed test environment. We don't just grade
              the answer — we grade how they think. It's the one hiring signal AI-polish can't
              fake.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register">
                <Button size="lg" rightIcon={<ArrowRight size={16} />} className="w-full sm:w-auto">
                  I'm hiring
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  I'm looking for a job
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success" /> Employer-controlled, per job
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success" /> Never the sole rejection reason
              </span>
            </div>
          </div>

          {/* Mockup card — stylized scenario timer, matches restyled in-app component */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Scenario question
                </span>
                <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                  4:12
                </span>
              </div>
              <p className="mb-6 text-sm leading-relaxed text-foreground">
                "A customer-facing API you own starts returning 500s intermittently under load.
                Walk through how you'd triage this in production, right now."
              </p>
              <div className="mb-4 h-20 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Candidate is typing…
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Graded for reasoning, not polish. Employer sees the raw answer + an AI summary.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Feature grid                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="scenario-engine" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Built to replace the whole broken hiring loop
            </h2>
            <p className="mt-3 text-muted-foreground">
              Not just a better job board — a pre-qualification, screening, and communication
              layer, end to end.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Timer}
              title="Timed, isolated scenario tests"
              description="A fullscreen, locked environment with a countdown timer and anti-gaming signals — tab-switch detection, paste detection, keystroke cadence — surfaced to the employer, never auto-rejecting."
            />
            <FeatureCard
              icon={Target}
              title="Semantic resume matching"
              description="Every resume and job description is embedded and compared by cosine similarity before an application is even allowed through, so nobody wastes time on a guaranteed rejection."
            />
            <FeatureCard
              icon={MessagesSquare}
              title="Pipeline broadcast channels"
              description="Once shortlisted, candidates join a real-time channel per job — no more mass emails, no more silence. Rejected candidates are removed automatically, with a reason."
            />
            <FeatureCard
              icon={Gauge}
              title="Live token-cost dashboard"
              description="Employers see exactly what every scenario evaluation and resume match costs in real time — transparent, AWS-style usage billing, not a black box."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Verified employers only"
              description="Business email + company verification before any job goes live, so candidates aren't burning override quota on fake postings."
            />
            <FeatureCard
              icon={Sparkles}
              title="A feed built for you, not everyone"
              description="Candidates see jobs ranked by their actual resume embedding — not a generic firehose. Low-fit roles are hidden by default, not spammed."
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works — split by role                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <RolePathCard
              eyebrow="For candidates"
              title="Apply less. Get seen more."
              steps={[
                "Upload your resume once — we embed it and match it against every open role.",
                "See a personalized, ranked feed instead of a generic job board.",
                "Prove yourself with a scenario, not just a polished PDF.",
                "Track every application live — no more email black holes.",
              ]}
              ctaLabel="Find your next role"
              href="/auth/register"
            />
            <RolePathCard
              id="for-employers"
              eyebrow="For employers"
              title="Screen for thinking, not prompting."
              steps={[
                "Post a role and optionally enable the Scenario Engine — no setup beyond a toggle.",
                "Get a ranked candidate list with match score, scenario score, and an AI summary.",
                "Manage the entire pipeline in one broadcast channel — no spreadsheets.",
                "See live token cost per job, per hire — full cost transparency.",
              ]}
              ctaLabel="Start hiring"
              href="/auth/register"
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                           */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-semibold text-foreground">HireIQ</span>
          </div>
          <p>AI-native hiring — built for people who ship products, not just features.</p>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/auth/register" className="hover:text-foreground transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local subcomponents
// ---------------------------------------------------------------------------

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-6">
      <CardContent className="p-0">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function RolePathCard({
  id,
  eyebrow,
  title,
  steps,
  ctaLabel,
  href,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  steps: string[];
  ctaLabel: string;
  href: string;
}) {
  return (
    <div id={id} className="rounded-2xl border border-border bg-card p-8">
      <span className="text-xs font-semibold uppercase tracking-widest text-primary">
        {eyebrow}
      </span>
      <h3 className="mt-2 text-xl font-bold text-foreground">{title}</h3>
      <ol className="mt-6 space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-muted-foreground">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <Link href={href} className="mt-7 block">
        <Button variant="outline" className="w-full" rightIcon={<ArrowRight size={16} />}>
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}