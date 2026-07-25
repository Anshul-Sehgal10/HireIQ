import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users,
  Briefcase,
  Upload,
  Search,
  Timer,
  TrendingUp,
  ListChecks,
  MessagesSquare,
  Gauge,
  ArrowLeftRight,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Button from "@/components/ui/Button";
import TypingScenarioCard from "@/components/landing/TypingScenarioCard";
import ScrollReveal from "@/components/landing/ScrollReveal";
import ParallaxBlob from "@/components/landing/ParallaxBlob";
import FeatureTimeline from "@/components/landing/FeatureTimeline";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ---------------------------------------------------------------- */}
      {/* Header - floating glass pill                                     */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-3 z-40 mx-auto w-full max-w-5xl px-3 sm:top-4 sm:px-4">
        <div className="flex h-13 items-center justify-between rounded-full border border-border/60 bg-background/70 px-3.5 shadow-lg shadow-black/5 backdrop-blur-xl sm:h-14 sm:px-5">
          <Link href="/" className="group flex items-center gap-2 sm:gap-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125" />
            <span className="text-sm font-bold tracking-tight sm:text-base">HireIQ</span>
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

          <div className="flex items-center gap-1 sm:gap-2">
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
      {/* Hero + Feature timeline - one continuous background/clip context */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-background via-background to-muted/40"
        />

        <ParallaxBlob
          speed={0.18}
          className="top-[-4rem] h-72 w-72 rounded-full bg-primary/15 blur-3xl sm:h-96 sm:w-96 sm:top-[-5rem] lg:top-[-6rem] lg:h-120 lg:w-120"
          style={{ left: "50%", marginLeft: "-9rem" }}
        />
        <ParallaxBlob
          speed={-0.1}
          className="top-[55vh] right-[-3rem] h-56 w-56 rounded-full bg-primary/10 blur-3xl sm:h-72 sm:w-72 sm:right-[-3.5rem] lg:top-[60vh] lg:h-96 lg:w-96 lg:right-[-4rem]"
        />

        {/* Hero */}
        <section className="relative flex min-h-[auto] items-center py-16 sm:py-20 md:min-h-[88vh] md:py-0">
          <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 sm:gap-12 sm:px-6 md:grid-cols-2 md:py-14 lg:py-16">
            <div className="flex flex-col justify-center animate-fade-in">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                A resume can be written by ChatGPT.
                <br />
                <span className="text-primary">A timed, live scenario can't.</span>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:mt-5 sm:text-base">
                Every applicant answers a role-specific scenario question, generated fresh from
                the job description, inside a locked, time-boxed test environment. We don't just
                grade the answer - we grade how they think. It's the one hiring signal AI-polish
                can't fake.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                <Link href="/auth/register" className="w-full sm:w-auto">
                  <Button size="lg" rightIcon={<ArrowRight size={16} />} className="w-full sm:w-auto">
                    I'm hiring
                  </Button>
                </Link>
                <Link href="/auth/register" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    I'm looking for a job
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-center px-2 sm:px-0">
              <div className="w-full max-w-sm animate-float-slow">
                <TypingScenarioCard />
              </div>
            </div>
          </div>
        </section>

        {/* Feature timeline */}
        <section id="scenario-engine" className="relative py-16 sm:py-20 md:py-24">
          <div
            className="absolute inset-0 bg-dot-grid opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,black,transparent)]"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Built to replace <span className="text-primary">the whole broken hiring loop</span>
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:mt-4 sm:text-base">
                Not just a better job board - a pre-qualification, screening, and communication
                layer, end to end.
              </p>
            </ScrollReveal>

            <div className="mt-10 sm:mt-14 md:mt-16">
              <FeatureTimeline />
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* How it works - two connected paths with a center connector       */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="relative py-16 sm:py-20 md:py-24">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              One platform, <span className="text-primary">two paths that meet in the middle</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:mt-4 sm:text-base">
              Candidates and employers move through the same pipeline from opposite ends -
              here's what each side actually does.
            </p>
          </ScrollReveal>

          <div className="relative grid gap-6 sm:gap-8 md:grid-cols-2 md:gap-6">
            {/* Center connector - desktop only */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border md:block"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md md:flex"
              aria-hidden="true"
            >
              <ArrowLeftRight size={18} />
            </div>

            <ScrollReveal>
              <RolePathCard
                icon={Users}
                eyebrow="For candidates"
                title="Apply less. Get seen more."
                tagline="Your resume works for you instead of disappearing into a pile."
                steps={[
                  { icon: Upload, text: "Upload your resume once - we embed it and match it against every open role." },
                  { icon: Search, text: "See a personalized, ranked feed instead of a generic job board." },
                  { icon: Timer, text: "Prove yourself with a scenario, not just a polished PDF." },
                  { icon: TrendingUp, text: "Track every application live - no more email black holes." },
                ]}
                ctaLabel="Find your next role"
                href="/auth/register"
              />
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <RolePathCard
                id="for-employers"
                icon={Briefcase}
                eyebrow="For employers"
                title="Screen for thinking, not prompting."
                tagline="Spend time on candidates who've already proven real ability."
                steps={[
                  { icon: Briefcase, text: "Post a role and optionally enable the Scenario Engine - no setup beyond a toggle." },
                  { icon: ListChecks, text: "Get a ranked candidate list with match score, scenario score, and an AI summary." },
                  { icon: MessagesSquare, text: "Manage the entire pipeline in one broadcast channel - no spreadsheets." },
                  { icon: Gauge, text: "See live token cost per job, per hire - full cost transparency." },
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
      <footer className="border-t border-border py-8 sm:py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-xs text-muted-foreground sm:px-6 sm:text-sm sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-semibold text-foreground">HireIQ</span>
          </div>
          <p className="max-w-xs sm:max-w-none">
            AI-native hiring - built for people who ship products, not just features.
          </p>
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

interface RoleStep {
  icon: React.ElementType;
  text: string;
}

function RolePathCard({
  id,
  icon: Icon,
  eyebrow,
  title,
  tagline,
  steps,
  ctaLabel,
  href,
}: {
  id?: string;
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  tagline: string;
  steps: RoleStep[];
  ctaLabel: string;
  href: string;
}) {
  return (
    <div
      id={id}
      className="group relative h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl sm:p-8"
    >
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 sm:h-11 sm:w-11">
          <Icon size={20} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</span>
          <h3 className="text-base font-bold text-foreground sm:text-lg">{title}</h3>
        </div>
      </div>

      <p className="mb-5 text-sm text-muted-foreground sm:mb-6">{tagline}</p>

      <ol className="space-y-4 sm:space-y-5">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isLast = i === steps.length - 1;
          return (
            <li key={i} className="relative flex gap-3.5 sm:gap-4">
              {!isLast && (
                <span
                  className="absolute left-[15px] top-8 w-px bg-border"
                  style={{ height: "calc(100% - 0.25rem)" }}
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors duration-300 group-hover:border-primary/40 group-hover:text-primary">
                <StepIcon size={14} />
              </span>
              <p className="pt-1 text-sm text-muted-foreground">{step.text}</p>
            </li>
          );
        })}
      </ol>

      <Link href={href} className="mt-7 block sm:mt-8">
        <Button variant="outline" className="w-full" rightIcon={<ArrowRight size={16} />}>
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}