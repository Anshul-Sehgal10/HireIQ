import Link from "next/link";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Button from "@/components/ui/Button";
import TypingScenarioCard from "@/components/landing/TypingScenarioCard";
import ScrollReveal from "@/components/landing/ScrollReveal";
import ParallaxBlob from "@/components/landing/ParallaxBlob";
import FeatureTimeline from "@/components/landing/FeatureTimeline";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------------------------------------------------------------- */}
      {/* Header - floating glass pill, detached from the edge             */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-4 z-40 mx-auto w-full max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between rounded-full border border-border/60 bg-background/70 px-5 shadow-lg shadow-black/5 backdrop-blur-xl">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125" />
            <span className="text-base font-bold tracking-tight">HireIQ</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
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
              className="hidden sm:inline-flex h-8 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
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
      {/* Hero + Feature timeline - one continuous gradient background so  */}
      {/* the two sections blend seamlessly instead of a hard section seam */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-background via-background to-muted/40"
        />

        {/* Hero */}
        <section className="relative flex min-h-[88vh] items-center overflow-hidden">
          <ParallaxBlob
            speed={0.18}
            className="top-[-8rem] h-120 w-120 rounded-full bg-primary/15 blur-3xl"
            style={{ left: "50%", marginLeft: "-15rem" }}
          />
          <ParallaxBlob
            speed={-0.12}
            className="bottom-[-6rem] right-[-4rem] h-96 w-96 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-6 py-14 md:grid-cols-2 md:py-16">
            <div className="flex flex-col justify-center animate-fade-in">
              {/* <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles size={12} />
                The Behavioral Scenario Engine
              </span> */}
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                A resume can be written by ChatGPT.
                <br />
                <span className="text-primary">A timed, live scenario can't.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
                Every applicant answers a role-specific scenario question, generated fresh from
                the job description, inside a locked, time-boxed test environment. We don't just
                grade the answer - we grade how they think. It's the one hiring signal AI-polish
                can't fake.
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
              {/* <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> Employer-controlled, per job
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> Never the sole rejection
                  reason
                </span>
              </div> */}
            </div>

            <div className="flex items-center justify-center">
              <div className="animate-float-slow">
                <TypingScenarioCard />
              </div>
            </div>
          </div>
        </section>

        {/* Feature timeline */}
        <section id="scenario-engine" className="relative overflow-hidden py-24">
          <div
            className="absolute inset-0 bg-dot-grid opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,black,transparent)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-6xl px-6">
            <ScrollReveal className="mx-auto max-w-2xl text-center">
              {/* <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles size={12} />
                Why HireIQ
              </span> */}
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                Built to replace <span className="text-primary">the whole broken hiring loop</span>
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                Not just a better job board - a pre-qualification, screening, and communication
                layer, end to end.
              </p>
            </ScrollReveal>

            <div className="mt-16">
              <FeatureTimeline />
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* How it works - split by role                                     */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ScrollReveal>
              <RolePathCard
                eyebrow="For candidates"
                title="Apply less. Get seen more."
                steps={[
                  "Upload your resume once - we embed it and match it against every open role.",
                  "See a personalized, ranked feed instead of a generic job board.",
                  "Prove yourself with a scenario, not just a polished PDF.",
                  "Track every application live - no more email black holes.",
                ]}
                ctaLabel="Find your next role"
                href="/auth/register"
              />
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <RolePathCard
                id="for-employers"
                eyebrow="For employers"
                title="Screen for thinking, not prompting."
                steps={[
                  "Post a role and optionally enable the Scenario Engine - no setup beyond a toggle.",
                  "Get a ranked candidate list with match score, scenario score, and an AI summary.",
                  "Manage the entire pipeline in one broadcast channel - no spreadsheets.",
                  "See live token cost per job, per hire - full cost transparency.",
                ]}
                ctaLabel="Start hiring"
                href="/auth/register"
              />
            </ScrollReveal>
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
          <p>AI-native hiring - built for people who ship products, not just features.</p>
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