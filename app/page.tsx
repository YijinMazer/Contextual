"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ContextualRunResponse, TraceStepStatus } from "@/lib/contextual/types"

/**
 * Contextual — single-file editorial page
 * Evidence-aware mediation agent for repairing miscommunication.
 *
 * Motion: subtle fade + slide reveals, staggered entrance, smooth
 * panel transitions, restrained hover states, delicate active pulses.
 */

const NAV_STATUS = [
  { label: "Session 01" },
  { label: "Evidence Linked", tone: "green" as const, active: true },
  { label: "Privacy Kept", tone: "green" as const },
]

const HERO_CHIPS = [
  { label: "Build", value: "0.5.0 — Alpha" },
  { label: "Mode", value: "Evidence-aware mediation" },
  { label: "Inputs", value: "2 private reads · 1 shared record" },
  { label: "Output", value: "Gap analysis · repair starters" },
  { label: "Boundary", value: "No verdicts" },
]

const TRUST_STRIP = [
  "Private reflections stay private",
  "Shared evidence stays cited",
  "Public context is used only when external facts matter",
]

const HOW_IT_WORKS_STEPS = [
  "Each person writes a private reflection",
  "Paste the shared conversation",
  "Contextual compares reflection vs evidence",
  "Review the gap analysis and repair starters",
]

const PRODUCT_BOUNDARIES = [
  "Contextual does not decide who is right.",
  "Private reflections are used as context, not shared content.",
  "Shared conversation is treated as evidence.",
  "Public context is only used when external facts matter.",
]

type SectionDef = {
  n: string
  label: string
  title: string
  lede: string
  kind: "cards" | "transcript" | "agent" | "interpretation" | "privacy"
  cards?: number
}

const SECTIONS: SectionDef[] = [
  {
    n: "00",
    label: "Intake",
    title: "Mark the rupture.",
    lede: "A short, structured intake. Two parties, a shared incident, and the words that landed wrong. No interpretation yet — only what was said, and when.",
    kind: "cards",
    cards: 2,
  },
  {
    n: "01",
    label: "Evidence",
    title: "Read the record.",
    lede: "Linked sources are read, redacted, and timestamped. Contextual never paraphrases. Every quoted line traces back to a verifiable artifact.",
    kind: "transcript",
  },
  {
    n: "02",
    label: "Interpretation",
    title: "Find the interpretation gap.",
    lede: "Two reads are produced side by side — one from each party's frame. The drift between them is mapped against evidence, not feelings.",
    kind: "interpretation",
  },
  {
    n: "03",
    label: "Repair",
    title: "Draft a repair path.",
    lede: "Repair paths are drafted as small, reviewable acts of communication. Each draft cites the exact evidence it bridges.",
    kind: "agent",
  },
  {
    n: "04",
    label: "Consent",
    title: "Bridge, then sign.",
    lede: "Nothing leaves on its own. Both parties read, redline, and co-sign the repair path. Provenance travels with the final exchange.",
    kind: "privacy",
  },
  {
    n: "05",
    label: "Log",
    title: "Seal the trace.",
    lede: "The session is sealed. A signed record — evidence, drafts, signatures — is exported as a single, portable document you can re-read later.",
    kind: "cards",
    cards: 1,
  },
]

/* ───────────────────────── Hooks ───────────────────────── */

/**
 * useReveal — adds the `ctx-reveal` class once the element enters the viewport.
 * Keeps content visible (no flash) for users with reduced motion via CSS.
 */
function useReveal<T extends HTMLElement>(options?: { once?: boolean; rootMargin?: string }) {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            if (options?.once !== false) obs.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: options?.rootMargin ?? "0px 0px -10% 0px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [options?.once, options?.rootMargin])

  return { ref, shown }
}

/* ───────────────────────── Page ───────────────────────── */

export default function Page() {
  // Form inputs
  const [personAReflection, setPersonAReflection] = useState('')
  const [personBReflection, setPersonBReflection] = useState('')
  const [sharedEvidence, setSharedEvidence] = useState('')
  const [usePublicContext, setUsePublicContext] = useState(false)
  const [isMockConnecting, setIsMockConnecting] = useState(false)

  // API state
  type ApiState = 'idle' | 'loading' | 'error' | 'success'
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiResponse, setApiResponse] = useState<ContextualRunResponse | null>(null)

  // Request cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  const mockConnectTimeoutRef = useRef<number | null>(null)

  const hasRequiredInputs =
    personAReflection.trim().length > 0 && personBReflection.trim().length > 0 && sharedEvidence.trim().length > 0

  const handleMockConnect = useCallback(() => {
    if (isMockConnecting) return

    setIsMockConnecting(true)
    mockConnectTimeoutRef.current = window.setTimeout(() => {
      setSharedEvidence([
        '[09:12] Alex: Hey, when you saw my message last night and did not reply, I started thinking you were upset with me.',
        '[09:14] Sam: I was still at work and honestly exhausted. I saw it, but I did not have the energy to answer well.',
        '[09:16] Alex: I get being tired, but no reply at all made me feel ignored.',
        '[09:19] Sam: I was not trying to ignore you. I thought a rushed reply would make it worse.',
        '[09:22] Alex: I would rather get a short heads-up than silence, because silence makes me fill in the blanks.',
        '[09:25] Sam: That is fair. I heard pressure in the message and shut down instead of saying I needed an hour.',
      ].join('\n'))
      setIsMockConnecting(false)
      mockConnectTimeoutRef.current = null
    }, 1500)
  }, [isMockConnecting])

  const handleRunAgent = useCallback(async () => {
    setApiState('loading')
    setApiError(null)

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/contextual/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          personAReflection,
          personBReflection,
          sharedEvidence,
          usePublicContext,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(err.error || 'API error')
      }

      const data = (await response.json()) as ContextualRunResponse
      setApiResponse(data)
      setApiState('success')
    } catch (err) {
      // Don't set error state if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[v0] Request cancelled')
        return
      }

      const msg = err instanceof Error ? err.message : 'Unknown error'
      setApiError(msg)
      setApiState('error')
    }
  }, [personAReflection, personBReflection, sharedEvidence, usePublicContext])

  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setApiState('idle')
    setApiError(null)
    setApiResponse(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (mockConnectTimeoutRef.current !== null) {
        window.clearTimeout(mockConnectTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <TopNav />
      <Hero />
      <main className="border-t border-border">
        <FlowSection
          section={{
            id: 'how',
            n: '01',
            label: 'How it works',
            title: 'See the product flow in one pass.',
            lede: 'Contextual is easiest to understand when you follow the same path the agent follows: private reflections, shared evidence, comparison, then a repair readout grounded in citations.',
          }}
        >
          {(shown) => <HowItWorksBlock shown={shown} />}
        </FlowSection>

        <FlowSection
          section={{
            id: 'inputs',
            n: '02',
            label: 'Inputs',
            title: 'Bring in the two inputs Contextual compares.',
            lede: 'Start with two private reflections and one shared conversation record. The reflections stay private. The shared conversation is treated as evidence.',
          }}
        >
          {(shown) => (
            <TranscriptBlock
              shown={shown}
              sharedEvidence={sharedEvidence}
              setSharedEvidence={setSharedEvidence}
              isMockConnecting={isMockConnecting}
              onMockConnect={handleMockConnect}
            />
          )}
        </FlowSection>

        <FlowSection
          section={{
            id: 'run',
            n: '03',
            label: 'Run Contextual',
            title: 'Run the mediation read against the current inputs.',
            lede: 'This step compares the reflections against the shared evidence, decides whether external facts matter, and returns a traceable readout.',
          }}
        >
          {(shown) => (
            <div className="space-y-4">
              <PrivacyBoundaryBlock
                shown={shown}
                personAReflection={personAReflection}
                setPersonAReflection={setPersonAReflection}
                personBReflection={personBReflection}
                setPersonBReflection={setPersonBReflection}
              />
              <AgentBlock
                shown={shown}
                onRun={handleRunAgent}
                onReset={handleReset}
                state={apiState}
                error={apiError}
                response={apiResponse}
                usePublicContext={usePublicContext}
                setUsePublicContext={setUsePublicContext}
                hasRequiredInputs={hasRequiredInputs}
              />
            </div>
          )}
        </FlowSection>

        <FlowSection
          section={{
            id: 'output',
            n: '04',
            label: 'Repair output',
            title: 'Review the repair output before going deeper.',
            lede: 'Read the concise repair summary first: what the evidence supports, where the conversation drifted, and the draft repair starters for each side.',
          }}
        >
          {(shown) => <RepairOutputBlock shown={shown} response={apiResponse} state={apiState} />}
        </FlowSection>

        <FlowSection
          section={{
            id: 'interpretation',
            n: '05',
            label: 'Interpretation gap',
            title: 'Open the interpretation gap only after the summary makes sense.',
            lede: 'This is the deeper read. It separates what was said from what was likely heard, then shows the bridge language that could restart the exchange.',
          }}
        >
          {(shown) => <InterpretationGapBlock shown={shown} response={apiResponse} state={apiState} />}
        </FlowSection>

        {apiState === 'success' && apiResponse && <LineageRail />}

        <FlowSection
          section={{
            id: 'privacy',
            n: '07',
            label: 'Privacy and consent',
            title: 'Keep the privacy boundary legible.',
            lede: 'Contextual is useful only if the boundary between private context and shared evidence remains clear. This section makes that boundary explicit.',
          }}
        >
          {(shown) => <PrivacyAndConsentBlock shown={shown} />}
        </FlowSection>

        <FlowSection
          section={{
            id: 'public',
            n: '08',
            label: 'Public context',
            title: 'Use public context only for external facts.',
            lede: 'Public context is not a general enrichment layer. It should only enter the run when the disagreement depends on a fact that can be checked outside the conversation itself.',
          }}
        >
          {(shown) => <PublicContextBlock shown={shown} response={apiResponse} usePublicContext={usePublicContext} />}
        </FlowSection>

        <FlowSection
          section={{
            id: 'log',
            n: '09',
            label: 'Session log',
            title: 'Keep the log, but move it to the end.',
            lede: 'The session log is still part of the system language, but it should follow the main task flow rather than compete with it.',
          }}
        >
          {(shown) => <SessionLogBlock shown={shown} />}
        </FlowSection>
      </main>
      <Footer />
    </div>
  )
}

/* ───────────────────────── Nav ───────────────────────── */

function TopNav() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="mx-auto max-w-[1320px] px-6 md:px-10">
        <div className="flex h-14 items-center justify-between gap-6">
          {/* Left: wordmark */}
          <div className="flex items-center gap-3">
            <div className="ctx-reveal" style={{ animationDelay: "60ms" }}>
              <Wordmark />
            </div>
            <span
              className="ctx-reveal hidden sm:inline-flex font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm"
              style={{ animationDelay: "140ms" }}
            >
              Alpha · Lab
            </span>
          </div>

          {/* Right: status + export */}
          <nav className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:flex items-center gap-2">
              {NAV_STATUS.map((s, i) => (
                <div key={s.label} className="ctx-reveal" style={{ animationDelay: `${220 + i * 80}ms` }}>
                  <StatusChip label={s.label} tone={s.tone} active={s.active} />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="ctx-reveal hidden md:inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground border border-border px-2 py-1 rounded-sm bg-card transition-colors duration-200 hover:border-foreground/30 hover:text-foreground"
              style={{ animationDelay: "440ms" }}
              aria-label="Open command palette"
            >
              <span aria-hidden className="font-sans text-[11px] tracking-tight text-foreground/80">⌘</span>
              <span aria-hidden className="font-sans text-[11px] tracking-tight text-foreground/80">K</span>
              <span aria-hidden className="text-border">·</span>
              <span>explore</span>
            </button>
            <button
              type="button"
              className="ctx-reveal font-mono text-[11px] uppercase tracking-[0.12em] bg-foreground text-primary-foreground px-3 py-1.5 rounded-sm transition-[opacity,transform] duration-200 hover:opacity-90 active:translate-y-px"
              style={{ animationDelay: "520ms" }}
            >
              Export
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}

function Wordmark() {
  return (
    <a href="#top" className="flex items-center gap-2 group" aria-label="Contextual home">
      <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-foreground transition-transform duration-300 group-hover:scale-110" />
      <span className="font-sans text-[15px] tracking-tight text-foreground">Contextual</span>
    </a>
  )
}

function StatusChip({
  label,
  tone,
  active,
}: {
  label: string
  tone?: "green" | "amber"
  active?: boolean
}) {
  const dotColor = tone === "green" ? "bg-green" : tone === "amber" ? "bg-amber" : "bg-muted-foreground"
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground border border-border px-2 py-1 rounded-sm bg-card transition-colors duration-200 hover:border-foreground/30">
      <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
        {active && <span className={`absolute inset-0 rounded-full ${dotColor} ctx-pulse-ring`} />}
        <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${dotColor} ${active ? "ctx-pulse" : ""}`} />
      </span>
      {label}
    </span>
  )
}

/* ───────────────────────── Hero ──────────────────────���── */

function Hero() {
  // Entrance is on mount, staggered. We rely on CSS animation with delay.
  return (
    <section id="top" className="relative border-b border-border">
      {/* Top system metadata strip */}
      <div className="border-b border-border bg-background/60">
        <div className="mx-auto max-w-[1320px] px-6 md:px-10">
          <div
            className="ctx-reveal flex flex-wrap items-center gap-x-6 gap-y-1 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            style={{ animationDelay: "40ms" }}
          >
            <span className="text-foreground">Doc 0.4.2</span>
            <span aria-hidden className="text-border">·</span>
            <span>Rev 14</span>
            <span aria-hidden className="text-border">·</span>
            <span>Compiled 2026.05.02</span>
            <span aria-hidden className="text-border">·</span>
            <span>Hash 0xA42F…91C</span>
            <span aria-hidden className="text-border">·</span>
            <span>Lat 37.7749 / Lon −122.4194</span>
            <span className="ml-auto hidden md:inline-flex items-center gap-1.5">
              <span aria-hidden className="h-1 w-1 rounded-full bg-green ctx-pulse" />
              Live
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-16 md:py-28">
        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          {/* Left marker */}
          <div className="col-span-12 md:col-span-2">
            <div
              className="ctx-reveal flex md:flex-col items-baseline md:items-start gap-3 md:gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              style={{ animationDelay: "120ms" }}
            >
              <span className="text-foreground">I.</span>
              <span className="hidden md:inline">Overview</span>
              <span aria-hidden className="hidden md:block w-10 ctx-dotted" />
            </div>
          </div>

          {/* Right content */}
          <div className="col-span-12 md:col-span-10 max-w-[58rem]">
            <div
              className="ctx-reveal flex items-center gap-3 mb-8"
              style={{ animationDelay: "180ms" }}
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Contextual
              </span>
              <span aria-hidden className="ctx-rule hidden md:block" />
              <span className="hidden md:inline-flex font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                vol. 01
              </span>
            </div>

            <h1
              className="ctx-reveal font-sans text-balance text-[40px] leading-[1.05] tracking-[-0.02em] md:text-[72px] md:leading-[1.02] md:tracking-[-0.025em] text-foreground"
              style={{ animationDelay: "260ms", animationDuration: "780ms" }}
            >
              Find where a conversation went off track.
            </h1>

            <p
              className="ctx-reveal mt-8 max-w-[44rem] text-pretty text-[15px] md:text-[17px] leading-relaxed text-body"
              style={{ animationDelay: "420ms" }}
            >
              Contextual compares two private reflections with the shared conversation record to show
              where meaning drifted, what each person likely heard, and how to restart the
              conversation without deciding who is right.
            </p>

            <div
              className="ctx-reveal mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "500ms" }}
            >
              <a
                href="#section-inputs"
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] bg-foreground text-primary-foreground px-3 py-1.5 rounded-sm transition-[opacity,transform] duration-200 hover:opacity-90 active:translate-y-px"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                Run a mediation
              </a>
              <a
                href="#section-how"
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] border border-border text-muted-foreground px-3 py-1.5 rounded-sm transition-colors duration-200 hover:text-foreground hover:border-foreground/30"
              >
                See how it works
              </a>
            </div>

            <div
              className="ctx-reveal mt-8 grid gap-2 max-w-[52rem]"
              style={{ animationDelay: "600ms" }}
            >
              <div className="grid gap-2 md:grid-cols-3">
                {TRUST_STRIP.map((item) => (
                  <div key={item} className="ctx-corners border border-border rounded-sm bg-card/70 px-3 py-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
              <div className="ctx-corners border border-border rounded-sm bg-background/50 px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Product boundaries
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {PRODUCT_BOUNDARIES.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-body">
                      <span aria-hidden className="mt-2 h-1 w-1 rounded-full bg-foreground/70 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <dl className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 max-w-[48rem] border-t border-border pt-8">
              {HERO_CHIPS.map((c, i) => (
                <div
                  key={c.label}
                  className="ctx-reveal flex flex-col gap-1.5"
                  style={{ animationDelay: `${640 + i * 80}ms` }}
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {c.label}
                  </dt>
                  <dd className="font-mono text-[12px] text-foreground">{c.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

type FlowSectionMeta = {
  id: string
  n: string
  label: string
  title: string
  lede: string
}

function FlowSection({
  section,
  children,
  className = "",
}: {
  section: FlowSectionMeta
  children: (shown: boolean) => React.ReactNode
  className?: string
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <section id={`section-${section.id}`} className={`border-b border-border ${className}`} aria-labelledby={`heading-${section.id}`}>
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-16 md:py-24">
        <div ref={ref} className="grid grid-cols-12 gap-x-8 gap-y-10">
          <div className="col-span-12 md:col-span-2">
            <div className={`relative md:sticky md:top-24 ${shown ? "ctx-reveal" : "ctx-pre"}`}>
              <span
                aria-hidden
                data-shown={shown}
                style={{ "--ctx-delay": "180ms" } as React.CSSProperties}
                className="hidden md:block absolute -left-3 top-0 h-full w-px bg-foreground/30 ctx-trace-y"
              />
              <div className="hidden md:flex items-center gap-2 mb-4">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full border border-foreground/40" />
                <span aria-hidden className="block h-px w-6 bg-foreground/40" />
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  marker
                </span>
              </div>
              <div className="flex md:flex-col items-baseline md:items-start gap-3 md:gap-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  § {section.n}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                  {section.label}
                </div>
              </div>
              <div aria-hidden className="hidden md:flex items-center gap-2 mt-3">
                <span className="block w-12 h-px bg-foreground/40" />
                <span className="block h-1 w-1 bg-foreground/40" />
                <span className="block w-6 ctx-dotted" />
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-10">
            <h2
              id={`heading-${section.id}`}
              className={`font-sans text-pretty text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.02em] text-foreground max-w-[42rem] ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
              style={{ animationDelay: "80ms" }}
            >
              {section.title}
            </h2>
            <p
              className={`mt-5 max-w-[40rem] text-[15px] leading-relaxed text-body ${shown ? "ctx-reveal" : "ctx-pre"}`}
              style={{ animationDelay: "160ms" }}
            >
              {section.lede}
            </p>

            <div className="mt-10">{children(shown)}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorksBlock({ shown }: { shown: boolean }) {
  const EXAMPLE_ROWS = [
    { label: "What A thought", value: "B stepping in meant B did not trust A to finish the work." },
    { label: "What B meant", value: "B thought they were helping and had not realized A saw the work as settled." },
    { label: "Shared evidence", value: "The thread shows a direct ownership/help mismatch, followed by a defensive reply." },
    { label: "What Contextual found", value: "The conversation drifted from process into perceived intent before either person checked the other meaning." },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <article
        className={`ctx-corners border border-border rounded-sm bg-card overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
        style={{ animationDelay: "240ms" }}
      >
        <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            01.01 / How it works
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            4 steps
          </span>
        </header>
        <ol className="grid md:grid-cols-2">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <li
              key={step}
              className={`px-5 py-4 ${index % 2 === 0 ? "md:border-r" : ""} ${index < 2 ? "border-b" : ""} border-border ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
              style={{ animationDelay: `${300 + index * 70}ms` }}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                Step {index + 1}
              </div>
              <p className="text-[14px] leading-relaxed text-foreground max-w-[32ch]">{step}</p>
            </li>
          ))}
        </ol>
      </article>

      <article
        className={`ctx-corners border border-border rounded-sm bg-background/50 overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
        style={{ animationDelay: "320ms" }}
      >
        <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            01.02 / Example read
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            compact case
          </span>
        </header>
        <div className="px-5 py-2">
          {EXAMPLE_ROWS.map((row, index) => (
            <div
              key={row.label}
              className={`grid gap-2 py-3 ${index < EXAMPLE_ROWS.length - 1 ? "border-b border-dashed border-border" : ""} ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
              style={{ animationDelay: `${380 + index * 60}ms` }}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{row.label}</div>
              <p className="text-[13px] leading-relaxed text-foreground">{row.value}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}

function RepairOutputBlock({
  shown,
  response,
  state,
}: {
  shown: boolean
  response: ContextualRunResponse | null
  state: 'idle' | 'loading' | 'error' | 'success'
}) {
  const topEvidence = response?.evidenceHighlights[0]
  const topUncertainty = response?.uncertainties[0]

  return (
    <article
      className={`ctx-corners border border-border rounded-sm bg-card overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          04.01 / Repair output
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {state === 'success' ? 'ready to review' : state === 'loading' ? 'waiting on run' : 'awaiting inputs'}
        </span>
      </header>

      {response ? (
        <div className="grid gap-0 md:grid-cols-2">
          <div className="px-5 py-5 border-b md:border-b-0 md:border-r border-border">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
              What Contextual found
            </div>
            <p className="text-[14px] leading-relaxed text-foreground">{response.whatBroke}</p>
            <div className="mt-4 pt-4 border-t border-dashed border-border">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                Evidence highlight
              </div>
              <p className="text-[13px] leading-relaxed text-foreground">
                {topEvidence
                  ? `${topEvidence.citation} · ${topEvidence.observation}`
                  : 'Shared evidence will appear here once a run completes.'}
              </p>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
              Repair starters
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-sm border border-border bg-background/50">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Person A
                </div>
                <p className="text-[13px] leading-relaxed text-foreground italic">{response.repairStarterA}</p>
              </div>
              <div className="p-3 rounded-sm border border-border bg-background/50">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Person B
                </div>
                <p className="text-[13px] leading-relaxed text-foreground italic">{response.repairStarterB}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-border text-[12px] leading-relaxed text-body">
              {topUncertainty?.detail ?? 'This section stays cautious and separates evidence from interpretation.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-6">
          <p className="text-[14px] leading-relaxed text-body max-w-[42rem]">
            After you run Contextual, this section will summarize what the shared record supports,
            where meaning likely drifted, and two neutral repair starters to review.
          </p>
        </div>
      )}
    </article>
  )
}

function PrivacyAndConsentBlock({ shown }: { shown: boolean }) {
  return (
    <article
      className={`ctx-corners border border-border rounded-sm bg-card overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          07.01 / Privacy and consent
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          boundary · explicit
        </span>
      </header>
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="px-5 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Stays private
          </div>
          <ul className="space-y-3">
            {[
              'Each private reflection is context for the agent, not shared content.',
              'Working notes and discarded drafts stay on the private side of the boundary.',
              'The agent should not quote a private reflection back as if it were evidence.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
                <span aria-hidden className="mt-2 h-1 w-1 rounded-full bg-foreground/70 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Can be reviewed together
          </div>
          <ul className="space-y-3">
            {[
              'The shared conversation is treated as evidence and cited by line.',
              'Repair starters are drafts to review, not verdicts to enforce.',
              'Nothing should leave as a final repair message without clear participant consent.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
                <span aria-hidden className="mt-2 h-1 w-1 rounded-full bg-foreground/70 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

function PublicContextBlock({
  shown,
  response,
  usePublicContext,
}: {
  shown: boolean
  response: ContextualRunResponse | null
  usePublicContext: boolean
}) {
  const status = response?.publicContextDecision
    ? response.publicContextDecision.rationale
    : usePublicContext
      ? 'Public context is enabled for the next run, but it should still be used only when the conflict depends on external facts.'
      : 'Public context is off by default until you explicitly enable it for a run.'

  return (
    <article
      className={`ctx-corners border border-border rounded-sm bg-card overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          08.01 / Public context
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          checked only if needed
        </span>
      </header>
      <div className="grid gap-0 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        {[
          {
            label: 'Use it when',
            body: 'The disagreement depends on policies, pricing, availability, delays, reviews, or another external fact.',
          },
          {
            label: 'Skip it when',
            body: 'The conflict is mainly about tone, implication, wording, or what each person inferred from the same exchange.',
          },
          {
            label: 'Current status',
            body: status,
          },
        ].map((item) => (
          <div key={item.label} className="px-5 py-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
              {item.label}
            </div>
            <p className="text-[13px] leading-relaxed text-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

function SessionLogBlock({ shown }: { shown: boolean }) {
  return (
    <article
      className={`ctx-corners border border-border rounded-sm bg-card overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          09.01 / Session log
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          portable summary
        </span>
      </header>
      <div className="grid gap-0 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="px-5 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Current session shape
          </div>
          <dl className="grid gap-3">
            {[
              ['Artifacts', '1 transcript · 2 reflections · 1 repair readout'],
              ['Output', 'Gap analysis · repair starters · trace'],
              ['Export', 'session-01.read.signed'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[110px_1fr] gap-3 items-baseline">
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
                <dd className="font-sans text-[13px] leading-snug text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="px-5 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
            Review posture
          </div>
          <ul className="space-y-3 text-[13px] leading-relaxed text-foreground">
            <li className="flex items-start gap-2"><span aria-hidden className="mt-2 h-1 w-1 rounded-full bg-foreground/70 shrink-0" /><span>Shared evidence stays cited and line-addressable.</span></li>
            <li className="flex items-start gap-2"><span aria-hidden className="mt-2 h-1 w-1 rounded-full bg-foreground/70 shrink-0" /><span>Private reflections stay on the private side unless a participant chooses otherwise.</span></li>
            <li className="flex items-start gap-2"><span aria-hidden className="mt-2 h-1 w-1 rounded-full bg-foreground/70 shrink-0" /><span>Repair language remains reviewable and does not decide who was right.</span></li>
          </ul>
        </div>
      </div>
    </article>
  )
}

/**
 * SignalInspector — an interactive scope for the conversation.
 * Hover or focus the plotted moments to read out what happened at each point.
 * Keyboard: arrow keys cycle through specimens; Enter pins one.
 */
type Specimen = {
  id: string
  x: number // 0..760
  y: number // 0..56
  t: string
  who: "A" | "B" | "—"
  kind: "signal" | "trigger" | "neutral"
  label: string
  detail: string
  source: string
}

const SPECIMENS: Specimen[] = [
  {
    id: "S-01",
    x: 80,
    y: 40,
    t: "00:48",
    who: "B",
    kind: "neutral",
    label: "Deadline introduced",
    detail: "B brings a target ship date into the thread without framing it as a request.",
    source: "thread/launch · L98",
  },
  {
    id: "S-02",
    x: 200,
    y: 33,
    t: "02:14",
    who: "A",
    kind: "signal",
    label: "Frame mismatch",
    detail: "A reads B's deadline as a deliverable; B intended it as a checkpoint.",
    source: "thread/launch · L132",
  },
  {
    id: "S-03",
    x: 320,
    y: 32,
    t: "04:32",
    who: "B",
    kind: "trigger",
    label: "Drift detected",
    detail: "Affective load rises. Topic shifts from copy ownership to perceived trust.",
    source: "thread/launch · L156",
  },
  {
    id: "S-04",
    x: 480,
    y: 22,
    t: "06:10",
    who: "B",
    kind: "signal",
    label: "Re-frame attempt",
    detail: "B retries with a softened framing but doesn't address the trigger.",
    source: "thread/launch · L171",
  },
  {
    id: "S-05",
    x: 600,
    y: 20,
    t: "09:14",
    who: "A",
    kind: "trigger",
    label: "Withdrawal",
    detail: "A pulls back. Replies become shorter, latency between turns widens.",
    source: "thread/launch · L210",
  },
  {
    id: "S-06",
    x: 720,
    y: 30,
    t: "11:50",
    who: "—",
    kind: "neutral",
    label: "Shared silence",
    detail: "No turn for ~9 minutes. Session candidate for repair drafting.",
    source: "thread/launch · L244",
  },
]

function SignalInspector() {
  const w = 760
  const h = 56
  const pts: [number, number][] = [
    [0, 38], [40, 36], [80, 40], [120, 34], [160, 37], [200, 33],
    [240, 35], [280, 30], [320, 32], [360, 28], [400, 30],
    [440, 26], [480, 22], [520, 18], [560, 24], [600, 20],
    [640, 28], [680, 24], [720, 30], [760, 26],
  ]
  const path = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ")

  const [hoverId, setHoverId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string>("S-03")
  const [isPlaying, setIsPlaying] = useState(false)
  const activeId = hoverId ?? pinnedId
  const active = SPECIMENS.find((s) => s.id === activeId) ?? SPECIMENS[2]
  const activeIdx = SPECIMENS.findIndex((s) => s.id === active.id)

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const idx = SPECIMENS.findIndex((s) => s.id === activeId)
      const next = (idx + dir + SPECIMENS.length) % SPECIMENS.length
      setPinnedId(SPECIMENS[next].id)
      setHoverId(null)
    },
    [activeId],
  )

  // Auto-replay: advance through specimens at a steady tempo.
  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      setHoverId(null)
      setPinnedId((cur) => {
        const i = SPECIMENS.findIndex((s) => s.id === cur)
        const next = (i + 1) % SPECIMENS.length
        // Auto-stop after wrapping to S-01 to avoid infinite spin.
        if (next === 0) {
          setIsPlaying(false)
          return SPECIMENS[0].id
        }
        return SPECIMENS[next].id
      })
    }, 1400)
    return () => window.clearInterval(id)
  }, [isPlaying])

  return (
    <div className="ctx-corners border border-border rounded-sm bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Signal inspector · session 01
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-2">
          <span aria-hidden className="hidden sm:inline">hover · click · ↩ pin</span>
          <span aria-hidden className="text-border">·</span>
          <span>
            <span className="text-foreground tabular-nums">{String(activeIdx + 1).padStart(2, "0")}</span>
            <span className="text-muted-foreground"> / {String(SPECIMENS.length).padStart(2, "0")}</span>
          </span>
        </span>
      </div>

      {/* Scope */}
      <div className="px-4 pt-4 pb-2">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Conversational signal trace with hoverable specimens"
          className="block w-full h-14 text-foreground select-none"
          onMouseLeave={() => setHoverId(null)}
        >
          {/* Baseline */}
          <line x1="0" y1={h - 8} x2={w} y2={h - 8} stroke="var(--border)" strokeWidth="1" />
          {/* Tick marks */}
          {Array.from({ length: 21 }).map((_, i) => (
            <line
              key={i}
              x1={(i * w) / 20}
              y1={h - 8}
              x2={(i * w) / 20}
              y2={h - (i % 5 === 0 ? 12 : 10)}
              stroke="var(--border)"
              strokeWidth="1"
            />
          ))}
          {/* Drift threshold */}
          <line x1="0" y1="28" x2={w} y2="28" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
          {/* Signal */}
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active vertical guide */}
          {active && (
            <line
              x1={active.x}
              y1="0"
              x2={active.x}
              y2={h - 8}
              stroke={active.kind === "trigger" ? "var(--amber)" : active.kind === "signal" ? "var(--green)" : "var(--foreground)"}
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity={active.kind === "neutral" ? 0.4 : 0.7}
            />
          )}

          {/* Specimens — hoverable */}
          {SPECIMENS.map((s) => {
            const isActive = s.id === activeId
            const fill =
              s.kind === "trigger"
                ? "var(--amber-surface)"
                : s.kind === "signal"
                  ? "var(--green-surface)"
                  : "var(--background)"
            const stroke =
              s.kind === "trigger" ? "var(--amber)" : s.kind === "signal" ? "var(--green)" : "var(--foreground)"
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={`Specimen ${s.id} — ${s.label} at t+${s.t}`}
                onMouseEnter={() => setHoverId(s.id)}
                onFocus={() => setHoverId(s.id)}
                onBlur={() => setHoverId(null)}
                onClick={() => setPinnedId(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setPinnedId(s.id)
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault()
                    cycle(1)
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault()
                    cycle(-1)
                  }
                }}
                className="cursor-pointer outline-none"
                style={{ transition: "opacity 200ms" }}
              >
                {/* Hit area */}
                <circle cx={s.x} cy={s.y} r={14} fill="transparent" />
                {/* Ring on active */}
                {isActive && (
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={7}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                )}
                {/* Marker */}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={isActive ? 3.5 : 2.75}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.25"
                />
              </g>
            )
          })}
        </svg>

        {/* x-axis ledger */}
        <div className="flex items-center justify-between mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>t 00:00</span>
          <span>04:32</span>
          <span>09:14</span>
          <span>14:00</span>
        </div>

        {/* Scrub strip — clickable specimen ledger */}
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
            scrub
          </span>
          <span aria-hidden className="block flex-1 h-px bg-border" />
          <ol
            className="flex items-center gap-1.5"
            role="tablist"
            aria-label="Specimen scrubber"
          >
            {SPECIMENS.map((s, i) => {
              const isActive = s.id === active.id
              const tone =
                s.kind === "trigger"
                  ? "bg-amber border-amber"
                  : s.kind === "signal"
                    ? "bg-green border-green"
                    : "bg-foreground/70 border-foreground/70"
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Step ${i + 1} — ${s.label}`}
                    onClick={() => {
                      setPinnedId(s.id)
                      setHoverId(null)
                    }}
                    className={`group relative inline-flex items-center justify-center h-3.5 w-3.5 rounded-sm border ${
                      isActive ? tone : "bg-transparent border-border hover:border-foreground/60"
                    } transition-colors`}
                  >
                    <span aria-hidden className={`block h-1 w-1 rounded-full ${isActive ? "bg-background" : "bg-muted-foreground group-hover:bg-foreground"}`} />
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      {/* Readout */}
      <div className="border-t border-border grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-x-5 gap-y-2 px-4 py-3 bg-background/60">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`relative inline-flex h-1.5 w-1.5`}
          >
            <span
              className={`absolute inset-0 rounded-full ${
                active.kind === "trigger"
                  ? "bg-amber"
                  : active.kind === "signal"
                    ? "bg-green"
                    : "bg-muted-foreground"
              } ${active.kind !== "neutral" ? "ctx-pulse-ring" : ""}`}
            />
            <span
              className={`relative inline-block h-1.5 w-1.5 rounded-full ${
                active.kind === "trigger"
                  ? "bg-amber"
                  : active.kind === "signal"
                    ? "bg-green"
                    : "bg-muted-foreground"
              }`}
            />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
            {active.id} · t+{active.t}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-sans text-[14px] leading-snug tracking-tight text-foreground">
            {active.label}
          </div>
          <p className="text-[12px] leading-relaxed text-body mt-0.5">{active.detail}</p>
        </div>
        <div className="flex md:flex-col items-start md:items-end gap-2 md:gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>
            {active.who === "—" ? "shared" : `Party ${active.who}`} · {active.kind}
          </span>
          <span>{active.source}</span>
        </div>
      </div>

      {/* Footer — replay controls */}
      <div className="border-t border-border flex flex-wrap items-center justify-between gap-3 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <div className="flex items-center gap-3">
          {/* Play / pause */}
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            aria-pressed={isPlaying}
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
            className="inline-flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity"
          >
            <span
              aria-hidden
              className={`inline-flex h-3.5 w-3.5 items-center justify-center border border-foreground/60 rounded-sm ${
                isPlaying ? "bg-foreground text-background" : "bg-transparent"
              }`}
            >
              {isPlaying ? (
                <svg viewBox="0 0 8 8" className="h-2 w-2" aria-hidden>
                  <rect x="1.5" y="1" width="1.5" height="6" fill="currentColor" />
                  <rect x="5" y="1" width="1.5" height="6" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 8 8" className="h-2 w-2" aria-hidden>
                  <path d="M2 1 L7 4 L2 7 Z" fill="currentColor" />
                </svg>
              )}
            </span>
            {isPlaying ? "Pause" : "Replay"}
          </button>
          <span aria-hidden className="text-border">·</span>
          {/* Step controls */}
          <button
            type="button"
            onClick={() => cycle(-1)}
            aria-label="Previous specimen"
            className="hover:text-foreground transition-colors"
          >
            ←
          </button>
          <span className="text-foreground tabular-nums">
            step {String(activeIdx + 1).padStart(2, "0")}/{String(SPECIMENS.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => cycle(1)}
            aria-label="Next specimen"
            className="hover:text-foreground transition-colors"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span>{pinnedId === activeId ? "pinned" : "preview"}</span>
          <span aria-hidden className="text-border">·</span>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              setPinnedId("S-03")
              setHoverId(null)
            }}
            className="hover:text-foreground transition-colors"
          >
            ↺ reset to drift
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Section wrapper ───────────────────────── */

function Section({
  section,
  isLast,
  formInputs,
  evidenceInput,
  agentControls,
  publicContextToggle,
}: {
  section: SectionDef
  isLast: boolean
  formInputs?: {
    personAReflection: string
    setPersonAReflection: (v: string) => void
    personBReflection: string
    setPersonBReflection: (v: string) => void
  }
  evidenceInput?: {
    sharedEvidence: string
    setSharedEvidence: (v: string) => void
    isMockConnecting?: boolean
    onMockConnect?: () => void
  }
  agentControls?: {
    onRun: () => Promise<void>
    onReset: () => void
    state: 'idle' | 'loading' | 'error' | 'success'
    error: string | null
    response: any
    hasRequiredInputs?: boolean
  }
  publicContextToggle?: {
    value: boolean
    onChange: (v: boolean) => void
  }
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <section
      id={`section-${section.n}`}
      className={`border-border ${isLast ? "" : "border-b"}`}
      aria-labelledby={`heading-${section.n}`}
    >
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-16 md:py-24">
        <div ref={ref} className="grid grid-cols-12 gap-x-8 gap-y-10">
          {/* Left: section number + label */}
          <div className="col-span-12 md:col-span-2">
            <div
              className={`relative md:sticky md:top-24 ${shown ? "ctx-reveal" : "ctx-pre"}`}
              style={{ animationDelay: "0ms" }}
            >
              {/* Trace line — draws top-down when the section enters view */}
              <span
                aria-hidden
                data-shown={shown}
                style={{ "--ctx-delay": "180ms" } as React.CSSProperties}
                className="hidden md:block absolute -left-3 top-0 h-full w-px bg-foreground/30 ctx-trace-y"
              />
              {/* Cipher mark — unique glyph per phase, decoded in the colophon */}
              <div className="hidden md:flex items-center gap-2 mb-4">
                <SectionGlyph n={section.n} />
                <span aria-hidden className="block h-px w-6 bg-foreground/40" />
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  cipher
                </span>
              </div>
              <div className="flex md:flex-col items-baseline md:items-start gap-3 md:gap-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  § {section.n}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                  {section.label}
                </div>
              </div>
              {/* Editorial rule + plotted markers */}
              <div aria-hidden className="hidden md:flex items-center gap-2 mt-3">
                <span className="block w-12 h-px bg-foreground/40" />
                <span className="block h-1 w-1 bg-foreground/40" />
                <span className="block w-6 ctx-dotted" />
              </div>
              <div
                aria-hidden
                className="hidden md:flex items-center gap-1.5 mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                <span>phase {section.n}</span>
                <span aria-hidden className="text-border">·</span>
                <span className="text-foreground/70">↳ inspect</span>
              </div>
            </div>
          </div>

          {/* Right: content */}
          <div className="col-span-12 md:col-span-10">
            <h2
              id={`heading-${section.n}`}
              className={`font-sans text-pretty text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.02em] text-foreground max-w-[42rem] ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
              style={{ animationDelay: "80ms" }}
            >
              {section.title}
            </h2>
            <p
              className={`mt-5 max-w-[40rem] text-[15px] leading-relaxed text-body ${shown ? "ctx-reveal" : "ctx-pre"}`}
              style={{ animationDelay: "160ms" }}
            >
              {section.lede}
            </p>

            {/* Body content */}
            <div className="mt-10">
              {section.kind === "cards" && <CardsBlock section={section} shown={shown} />}
              {section.kind === "transcript" && evidenceInput && (
                <TranscriptBlock
                  shown={shown}
                  sharedEvidence={evidenceInput.sharedEvidence}
                  setSharedEvidence={evidenceInput.setSharedEvidence}
                  isMockConnecting={evidenceInput.isMockConnecting ?? false}
                  onMockConnect={evidenceInput.onMockConnect ?? (() => {})}
                />
              )}
              {section.kind === "agent" && agentControls && publicContextToggle && (
                <AgentBlock
                  shown={shown}
                  onRun={agentControls.onRun}
                  onReset={agentControls.onReset}
                  state={agentControls.state}
                  error={agentControls.error}
                  response={agentControls.response}
                  usePublicContext={publicContextToggle.value}
                  setUsePublicContext={publicContextToggle.onChange}
                  hasRequiredInputs={agentControls.hasRequiredInputs ?? true}
                />
              )}
              {section.kind === "interpretation" && (
                <InterpretationGapBlock
                  shown={shown}
                  response={agentControls?.response ?? null}
                  state={agentControls?.state ?? 'idle'}
                />
              )}
              {section.kind === "privacy" && formInputs && (
                <PrivacyBoundaryBlock shown={shown} {...formInputs} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── Cards block ───────────────────────── */

function CardsBlock({ section, shown }: { section: SectionDef; shown: boolean }) {
  const cards = section.cards ?? 1
  return (
    <div
      className={`grid gap-4 ${
        cards === 1 ? "grid-cols-1" : cards === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
      }`}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className={shown ? "ctx-reveal" : "ctx-pre"}
          style={{ animationDelay: `${260 + i * 90}ms` }}
        >
          <PlaceholderCard sectionNumber={section.n} index={i + 1} sectionLabel={section.label} />
        </div>
      ))}
    </div>
  )
}

type CardField = { label: string; value: string }
const INTAKE_CARDS: CardField[][] = [
  [
    { label: "Party", value: "A · author" },
    { label: "Frame", value: "Ownership of launch copy" },
    { label: "Affect", value: "Withheld trust" },
    { label: "First utterance", value: "thread/launch · L142" },
  ],
  [
    { label: "Party", value: "B · collaborator" },
    { label: "Frame", value: "Offer of assistance" },
    { label: "Affect", value: "Misread intent" },
    { label: "First utterance", value: "thread/launch · L148" },
  ],
]

const LOG_CARDS: CardField[][] = [
  [
    { label: "Artifacts", value: "1 transcript · 2 readings · 1 draft" },
    { label: "Signatures", value: "Party A · Party B" },
    { label: "Sealed at", value: "2026.05.02 · 14:11 PT" },
    { label: "Export", value: "session-01.read.signed" },
  ],
]

// Extras revealed by the progressive card on click — keep these terse and signal-y.
const INTAKE_EXTRAS: CardField[][] = [
  [
    { label: "Latency", value: "1.8s avg · 3.4s p95" },
    { label: "Affect peak", value: "+02:07 · t 14:07" },
    { label: "Drift density", value: "0.31 · stable" },
  ],
  [
    { label: "Latency", value: "2.1s avg · 4.0s p95" },
    { label: "Affect peak", value: "+00:42 · t 14:04" },
    { label: "Drift density", value: "0.27 · stable" },
  ],
]

const LOG_EXTRAS: CardField[][] = [
  [
    { label: "Audit hash", value: "0xA42F…91C" },
    { label: "Witnesses", value: "2 · co-signed" },
    { label: "Re-reads", value: "0 · sealed" },
  ],
]

function PlaceholderCard({
  sectionNumber,
  sectionLabel,
  index,
}: {
  sectionNumber: string
  sectionLabel: string
  index: number
}) {
  const fields: CardField[] | undefined =
    sectionNumber === "00" ? INTAKE_CARDS[index - 1] : sectionNumber === "05" ? LOG_CARDS[index - 1] : undefined
  const extras: CardField[] | undefined =
    sectionNumber === "00" ? INTAKE_EXTRAS[index - 1] : sectionNumber === "05" ? LOG_EXTRAS[index - 1] : undefined

  const [expanded, setExpanded] = useState(false)
  const canExpand = !!extras

  const status =
    sectionNumber === "00" ? "Read" : sectionNumber === "05" ? "Sealed" : "Queued"
  const statusTone =
    sectionNumber === "05" ? "text-green" : "text-muted-foreground"

  return (
    <article className="ctx-corners ctx-lift group bg-card border border-border rounded-sm p-5 min-h-[200px] flex flex-col hover:border-foreground/25 hover:bg-card/80">
      <header className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-300 group-hover:text-foreground/70">
          {sectionNumber}.{String(index).padStart(2, "0")} / {sectionLabel}
        </div>
        <div className={`font-mono text-[10px] uppercase tracking-[0.16em] ${statusTone} inline-flex items-center gap-1.5`}>
          {sectionNumber === "05" && <span aria-hidden className="h-1 w-1 rounded-full bg-green" />}
          {status}
        </div>
      </header>

      {fields ? (
        <dl className="mt-5 flex flex-col">
          {fields.map((f, i) => (
            <div
              key={f.label}
              className={`grid grid-cols-[120px_1fr] items-baseline gap-3 py-2 ${
                i < fields.length - 1 ? "border-b border-dashed border-border" : ""
              }`}
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {f.label}
              </dt>
              <dd className="font-sans text-[13px] leading-snug text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex-1 mt-6 grid place-items-center">
          <div aria-hidden className="w-full ctx-dotted" />
        </div>
      )}

      {/* Progressive reveal — extras unlock on click. Always rendered so the
          drawer can animate height; visibility gated by data-open. */}
      {extras && (
        <div className="ctx-expand mt-3" data-open={expanded ? "true" : "false"} aria-hidden={!expanded}>
          <div>
            <dl
              className={`flex flex-col border-t border-dashed border-border pt-2 ctx-stagger ${
                expanded ? "" : ""
              }`}
              style={{ "--ctx-step": "55ms" } as React.CSSProperties}
            >
              <div
                className={`flex items-center justify-between py-1.5 ${expanded ? "ctx-fade-up" : ""}`}
                style={{ "--i": 0 } as React.CSSProperties}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  ↳ deeper read
                </span>
                <span aria-hidden className="font-mono text-[9px] uppercase tracking-[0.18em] text-border">
                  tier 02
                </span>
              </div>
              {extras.map((f, i) => (
                <div
                  key={f.label}
                  className={`grid grid-cols-[120px_1fr] items-baseline gap-3 py-2 ${
                    i < extras.length - 1 ? "border-b border-dashed border-border" : ""
                  } ${expanded ? "ctx-fade-up" : ""}`}
                  style={{ "--i": i + 1 } as React.CSSProperties}
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="font-sans text-[13px] leading-snug text-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      <footer className="mt-auto pt-5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {sectionNumber === "00" ? "intake · marked" : sectionNumber === "05" ? "trace · portable" : "empty"}
        </span>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse extras" : "Reveal extras"}
            className="font-mono text-[10px] tracking-[0.18em] text-border hover:text-foreground transition-colors"
          >
            {expanded ? "− − −" : "+ + +"}
          </button>
        ) : (
          <span aria-hidden className="font-mono text-[10px] tracking-[0.18em] text-border">
            + + +
          </span>
        )}
      </footer>
    </article>
  )
}

/* ───────────────────────── Transcript (§ 01) ───────────────────────── */

type TranscriptLine = {
  t: string
  who: "A" | "B"
  text: string
  annotation?: { kind: "SIGNAL" | "TRIGGER"; note: string }
  source: string
}

const TRANSCRIPT: TranscriptLine[] = [
  {
    t: "14:02",
    who: "A",
    text: "I thought we agreed I'd handle the launch copy on my own.",
    source: "thread/launch · L142",
  },
  {
    t: "14:04",
    who: "B",
    text: "I didn't realize that was final. I was trying to help.",
    annotation: { kind: "SIGNAL", note: "Frame mismatch — ownership vs. assistance" },
    source: "thread/launch · L148",
  },
  {
    t: "14:07",
    who: "A",
    text: "It felt like you didn't trust me to ship it.",
    annotation: { kind: "TRIGGER", note: "Affective load — trust" },
    source: "thread/launch · L156",
  },
  {
    t: "14:09",
    who: "B",
    text: "That's not what I meant. I should have asked first.",
    source: "thread/launch · L161",
  },
]

type TranscriptLayer = "verbatim" | "annotated" | "drift"

const TRANSCRIPT_DETAILS: { affect: string; latency: string; specimen: string; why: string }[] = [
  {
    affect: "neutral · stating constraint",
    latency: "+02:00",
    specimen: "S-01",
    why: "Establishes A's frame: ownership of the launch copy.",
  },
  {
    affect: "low · offering help",
    latency: "+03:00",
    specimen: "S-02",
    why: "B introduces a frame mismatch — assistance read as authority.",
  },
  {
    affect: "high · trust-coded",
    latency: "+02:00",
    specimen: "S-03",
    why: "Affective load rises. Topic shifts from copy to perceived trust.",
  },
  {
    affect: "low · acknowledgement",
    latency: "—",
    specimen: "S-04",
    why: "B re-frames with a softened framing but doesn't address the trigger.",
  },
]

function TranscriptBlock({
  shown,
  sharedEvidence,
  setSharedEvidence,
  isMockConnecting,
  onMockConnect,
}: {
  shown: boolean
  sharedEvidence: string
  setSharedEvidence: (v: string) => void
  isMockConnecting: boolean
  onMockConnect: () => void
}) {
  const lineCount = sharedEvidence.split('\n').filter((l) => l.trim()).length

  return (
    <article
      className={`ctx-corners bg-card border border-border rounded-sm overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          02.02 / Shared evidence — paste conversation
        </div>
        <div className="flex items-center gap-2">
          <StatusChip label={lineCount > 0 ? "Linked" : "Empty"} tone={lineCount > 0 ? "green" : undefined} active={lineCount > 0} />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {lineCount} lines
          </span>
        </div>
      </header>

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <label htmlFor="evidence-textarea" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Shared conversation record
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMockConnect}
              disabled={isMockConnecting}
              className="font-mono text-[10px] uppercase tracking-[0.14em] border border-border px-2 py-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMockConnecting ? 'Connecting MCP mock...' : 'Connect Slack bot (MCP)'}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              paste · cite · compare
            </span>
          </div>
        </div>
        <textarea
          id="evidence-textarea"
          value={sharedEvidence}
          onChange={(e) => setSharedEvidence(e.target.value)}
          placeholder="Paste the conversation here, or use the MCP mock connect button to auto-fill a linked thread."
          className={`w-full min-h-[300px] px-3 py-2.5 bg-background border border-border rounded-sm font-mono text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20 resize-none ${
            shown ? "ctx-reveal" : "ctx-pre"
          }`}
          style={{ animationDelay: "300ms" }}
        />
        <div className="mt-3 flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground" />
          {isMockConnecting
            ? 'Connecting to the local MCP mock server and pulling a shared thread for the demo.'
            : 'Paste the shared record directly, or let the MCP mock fetch it for the demo. Contextual will assign line numbers and cite them in the output.'}
        </div>
      </div>
    </article>
  )
}

/* ───────────────────────── Run Agent (§ 03) ───────────────────────── */

type RunState = "idle" | "running" | "complete"

const RUNBOOK = [
  { id: "01", label: "Link evidence sources", duration: 700 },
  { id: "02", label: "Read transcript · 412 lines", duration: 900 },
  { id: "03", label: "Trace drift vectors", duration: 1100 },
  { id: "04", label: "Draft repair paths", duration: 1000 },
  { id: "05", label: "Verify citations", duration: 700 },
] as const

const REPAIR_DRAFT = [
  "I want to address the launch thread directly.",
  "I read it as a question about ownership, not your trust in me.",
  "If you're open to it, I'll send the copy by Thursday and loop you in for a single review pass before we ship.",
  "— cites: thread/launch L142, L156",
]

function AgentBlock({
  shown,
  onRun,
  onReset,
  state,
  error,
  response,
  usePublicContext,
  setUsePublicContext,
  hasRequiredInputs,
}: {
  shown: boolean
  onRun: () => Promise<void>
  onReset: () => void
  state: 'idle' | 'loading' | 'error' | 'success'
  error: string | null
  response: ContextualRunResponse | null
  usePublicContext: boolean
  setUsePublicContext: (v: boolean) => void
  hasRequiredInputs: boolean
}) {
  const [isRunning, setIsRunning] = useState(false)

  const handleRun = async () => {
    setIsRunning(true)
    try {
      await onRun()
    } finally {
      setIsRunning(false)
    }
  }

  const handleReset = () => {
    setIsRunning(false)
    onReset()
  }

  // Render trace steps from API response
  const displaySteps = response?.trace || []
  const totalSteps = displaySteps.length || 5
  const completedSteps = state === 'success' ? displaySteps.length : 0
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <div
      className={`ctx-corners bg-card border border-border rounded-sm overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            03.01 / Run Contextual
          </span>
          <RunStatePill state={state === 'loading' ? 'running' : state === 'success' ? 'complete' : 'idle'} />
        </div>
        <div className="flex items-center gap-2">
          {state === 'idle' && (
            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning || !hasRequiredInputs}
              className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] bg-foreground text-primary-foreground px-3 py-1.5 rounded-sm transition-[opacity,transform] duration-200 hover:opacity-90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-primary-foreground transition-transform duration-300 group-hover:scale-110"
                />
                Run mediation
              </button>
            )}
          {(state === 'loading' || state === 'error') && (
            <button
              type="button"
              onClick={handleReset}
              className="font-mono text-[11px] uppercase tracking-[0.12em] border border-border text-muted-foreground px-3 py-1.5 rounded-sm hover:text-foreground hover:border-foreground/30 transition-colors duration-200"
            >
              Cancel
            </button>
          )}
          {state === 'success' && (
            <button
              type="button"
              onClick={handleReset}
              className="font-mono text-[11px] uppercase tracking-[0.12em] border border-border text-muted-foreground px-3 py-1.5 rounded-sm hover:text-foreground hover:border-foreground/30 transition-colors duration-200"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-px bg-border relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-foreground transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Settings strip */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-background/40">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={usePublicContext}
            onChange={(e) => setUsePublicContext(e.target.checked)}
            disabled={state !== 'idle'}
            className="accent-foreground"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Check public context if needed
          </span>
        </label>
      </div>

      {/* Body: split runbook / output */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Trace steps */}
        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-4">
            Trace steps · {completedSteps}/{totalSteps}
          </div>
          <ol className="flex flex-col gap-2">
              {displaySteps.length > 0 ? (
                displaySteps.map((step) => {
                  const status: TraceStepStatus = step.status
                  return <RunbookRow key={step.id} index={step.id} label={step.label} status={status} />
                })
              ) : (
                <div className="text-[12px] text-muted-foreground">Waiting for trace...</div>
              )}
          </ol>
        </div>

        {/* Output */}
        <div className="p-5 min-h-[260px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Output</div>
            {state === 'success' && (
              <span className="ctx-fade font-mono text-[10px] uppercase tracking-[0.16em] text-green inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green" />
                Ready to read
              </span>
            )}
            {state === 'error' && (
              <span className="ctx-fade font-mono text-[10px] uppercase tracking-[0.16em] text-amber inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber" />
                Error
              </span>
            )}
          </div>

          {state === 'idle' && (
            <div className="flex-1 grid place-items-center">
              <div className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Ready to run
                </div>
                <p className="text-[13px] leading-relaxed text-body max-w-[28ch] mx-auto">
                  {hasRequiredInputs
                    ? 'Reflections and evidence are in place. Run the agent to generate the report.'
                    : 'Add both private reflections and shared evidence above before you run the agent.'}
                </p>
              </div>
            </div>
          )}

          {state === 'loading' && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="font-mono text-[11px] text-muted-foreground inline-flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-foreground ctx-pulse" />
                Processing
                <span aria-hidden className="ctx-caret">▌</span>
              </div>
              <div
                aria-hidden
                className="w-full h-px"
                style={{
                  backgroundImage: "repeating-linear-gradient(90deg, var(--border) 0 6px, transparent 6px 12px)",
                  height: "1px",
                }}
              />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Analyzing reflections and evidence to find bridges.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex-1 grid place-items-center">
              <div className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber mb-2">
                  Error
                </div>
                <p className="text-[13px] leading-relaxed text-body max-w-[40ch] mx-auto">
                  {error}
                </p>
              </div>
            </div>
          )}

          {state === 'success' && response && (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Run status
                </div>
                <p className="text-[13px] leading-relaxed text-green inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green" />
                  {response.consentStatus}
                </p>
              </div>

              <div className="border-t border-border pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Signal Summary
                </div>
                <p className="text-[13px] leading-relaxed text-foreground">{response.signalSummary}</p>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  What Broke
                </div>
                <p className="text-[13px] leading-relaxed text-foreground">{response.whatBroke}</p>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Interpretation Gap
                </div>
                <p className="text-[13px] leading-relaxed text-foreground">{response.interpretationGap}</p>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Public Context Check
                </div>
                <p className="text-[13px] leading-relaxed text-foreground text-[12px]">{response.publicContextCheck}</p>
              </div>

              <div className="border-t border-border pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Repair starters
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-sm bg-background/60 border border-border/50">
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                      Person A Bridge
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground italic">{response.repairStarterA}</p>
                  </div>
                  <div className="p-2.5 rounded-sm bg-background/60 border border-border/50">
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                      Person B Bridge
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground italic">{response.repairStarterB}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-5 py-3 border-t border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          contextual.read · v0.5.0
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {state === 'idle' && 'idle · awaiting inputs'}
          {state === 'loading' && 'processing'}
          {state === 'error' && 'error · try again'}
          {state === 'success' && 'complete · ready to review'}
        </span>
      </footer>
    </div>
  )
}

function RunStatePill({ state }: { state: 'idle' | 'running' | 'complete' }) {
  if (state === "idle") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground border border-border px-2 py-0.5 rounded-sm bg-card">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Idle
      </span>
    )
  }
  if (state === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber border border-amber/40 px-2 py-0.5 rounded-sm bg-amber-surface/60">
        <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-amber ctx-pulse-ring" />
          <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-amber ctx-pulse" />
        </span>
        Tracing
      </span>
    )
  }
  return (
    <span className="ctx-fade inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-green border border-green/40 px-2 py-0.5 rounded-sm bg-green-surface/60">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green" />
      Complete
    </span>
  )
}

function RunbookRow({
  index,
  label,
  status,
}: {
  index: string
  label: string
  status: TraceStepStatus
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 py-2 px-3 rounded-sm border transition-colors duration-300 ${
        status === "active"
          ? "border-foreground/30 bg-background"
          : status === "done"
            ? "border-border bg-card"
            : status === "skipped"
              ? "border-border/60 bg-background/50"
            : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground w-6 shrink-0">
          {index}
        </span>
        <span
          className={`text-[13px] truncate transition-colors duration-300 ${
            status === "queued" ? "text-muted-foreground" : status === "skipped" ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {label}
        </span>
      </div>
      <RunStepStatus status={status} />
    </li>
  )
}

function RunStepStatus({ status }: { status: TraceStepStatus }) {
  if (status === "done") {
    return (
      <span className="ctx-fade inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-green">
        <CheckMark />
        Done
      </span>
    )
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber">
        <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-amber ctx-pulse-ring" />
          <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-amber ctx-pulse" />
        </span>
        Active
      </span>
    )
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        Skipped
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-border" />
      Queued
    </span>
  )
}

function CheckMark() {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 5.5 L4 8 L8.5 2.5" />
    </svg>
  )
}

/* ───────────────────────── Evidence Lineage Rail ───────────────────────── */

type LineageNode = {
  phase: string
  label: string
  scope: string
  state: "captured" | "verified" | "loaded" | "running" | "pending"
  shape: string
  artifacts: string[]
  note: string
}

const LINEAGE: LineageNode[] = [
  {
    phase: "01",
    label: "Private reflections",
    scope: "agent only",
    state: "captured",
    shape: "JSON · 1.2 KB",
    artifacts: ["reflection A", "reflection B", "working notes"],
    note: "Used as private context. Not quoted back as shared evidence.",
  },
  {
    phase: "02",
    label: "Shared evidence",
    scope: "consented",
    state: "verified",
    shape: "transcript · 412 lines",
    artifacts: ["thread/launch · L98–L244", "redactions · 4", "citations · 12"],
    note: "Treated as evidence. Each line resolves to its source.",
  },
  {
    phase: "03",
    label: "Public context",
    scope: "both parties",
    state: "loaded",
    shape: "graph · 3 sources",
    artifacts: ["calendar · launch", "doc · launch-copy.md", "thread · launch"],
    note: "Checked only when the disagreement depends on an external fact.",
  },
  {
    phase: "04",
    label: "Agent trace",
    scope: "audited",
    state: "running",
    shape: "trace · 5 steps",
    artifacts: ["link sources", "read transcript", "trace drift", "draft repair", "verify citations"],
    note: "Every step is logged, hashed, and replayable.",
  },
  {
    phase: "05",
    label: "Repair output",
    scope: "co-signed",
    state: "pending",
    shape: "draft · 1 candidate",
    artifacts: ["draft · v0.1", "redlines (A)", "redlines (B)", "co-sign · pending"],
    note: "Awaits both signatures before it leaves either inbox.",
  },
]

function LineageRail() {
  const { ref, shown } = useReveal<HTMLDivElement>()
  const [selectedId, setSelectedId] = useState<string>("04")
  const selected = LINEAGE.find((n) => n.phase === selectedId) ?? LINEAGE[3]
  const selectedIdx = LINEAGE.findIndex((n) => n.phase === selectedId)
  const stepNode = (dir: 1 | -1) => {
    const next = (selectedIdx + dir + LINEAGE.length) % LINEAGE.length
    setSelectedId(LINEAGE[next].phase)
  }
  return (
    <section id="section-trace" aria-labelledby="lineage-heading" className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-12 md:py-16">
        <div ref={ref} className="grid grid-cols-12 gap-x-8 gap-y-8">
          <div className="col-span-12 md:col-span-2">
            <div
              className={`md:sticky md:top-24 flex md:flex-col items-baseline md:items-start gap-3 md:gap-2 ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">§ 06</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">Trace</div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-10">
            <h2
              id="lineage-heading"
              className={`font-sans text-pretty text-[22px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-foreground max-w-[44rem] ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
              style={{ animationDelay: "60ms" }}
            >
              See what Contextual used, checked, and drafted.
            </h2>
            <p
              className={`mt-3 max-w-[40rem] text-[14px] leading-relaxed text-body ${
                shown ? "ctx-reveal" : "ctx-pre"
              }`}
              style={{ animationDelay: "140ms" }}
            >
              The trace below shows what stayed private, what counted as evidence, whether public
              context was checked, and how the repair output was assembled.
            </p>

            {/* Rail */}
            <div
              className={`ctx-corners mt-8 border border-border rounded-sm bg-background ${shown ? "ctx-reveal" : "ctx-pre"}`}
              style={{ animationDelay: "240ms" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  trace · contextual.read
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  read left → right
                </span>
              </div>

              {/* Nodes — clickable to inspect */}
              <ol className="grid grid-cols-1 md:grid-cols-5 md:divide-x divide-border">
                {LINEAGE.map((node, i) => {
                  const isSelected = node.phase === selectedId
                  return (
                    <li
                      key={node.phase}
                      className={`relative border-b md:border-b-0 border-border last:border-b-0 ${
                        shown ? "ctx-reveal" : "ctx-pre"
                      }`}
                      style={{ animationDelay: `${320 + i * 90}ms` }}
                    >
                      {/* Connector arrow on desktop */}
                      {i < LINEAGE.length - 1 && (
                        <span
                          aria-hidden
                          className="hidden md:block absolute top-1/2 -right-[7px] h-[11px] w-[11px] -translate-y-1/2 z-10"
                        >
                          <svg viewBox="0 0 11 11" fill="none" className="h-full w-full text-border">
                            <path
                              d="M1 5.5 H10 M6.5 2 L10 5.5 L6.5 9"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedId(node.phase)}
                        aria-pressed={isSelected}
                        aria-label={`Inspect phase ${node.phase} — ${node.label}`}
                        className={`ctx-lift group relative w-full text-left px-4 py-5 flex flex-col gap-2 ${
                          isSelected ? "bg-background" : "bg-transparent hover:bg-background/40"
                        }`}
                      >
                        {/* Active marker bar */}
                        <span
                          aria-hidden
                          className={`absolute left-0 top-0 bottom-0 w-px transition-colors ${
                            isSelected ? "bg-foreground" : "bg-transparent"
                          }`}
                        />

                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            Phase {node.phase}
                          </span>
                          <LineageStateChip state={node.state} />
                        </div>

                        <div className="font-sans text-[14px] leading-snug tracking-tight text-foreground">
                          {node.label}
                        </div>

                        <div className="mt-auto pt-2 border-t border-dashed border-border flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            scope · {node.scope}
                          </span>
                          <span
                            aria-hidden
                            className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                              isSelected ? "text-foreground" : "text-muted-foreground/60 group-hover:text-foreground/70"
                            }`}
                          >
                            {isSelected ? "● open" : "↳ inspect"}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>

              {/* Inspector panel — reveals what's at the selected phase */}
              <div
                className="ctx-fade-up border-t border-border bg-background/60 ctx-stagger"
                style={{ "--ctx-step": "60ms" } as React.CSSProperties}
                key={selectedId}
              >
                <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-x-6 gap-y-3">
                  {/* Selected header */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Phase {selected.phase}
                      </span>
                      <LineageStateChip state={selected.state} />
                    </div>
                    <div className="font-sans text-[15px] leading-snug tracking-tight text-foreground">
                      {selected.label}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      shape · {selected.shape}
                    </span>
                  </div>

                  {/* Artifact ledger */}
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                      artifacts at this phase
                    </div>
                    <ul className="flex flex-col">
                      {selected.artifacts.map((a, i) => (
                        <li
                          key={a}
                          className={`grid grid-cols-[24px_1fr] items-baseline gap-3 py-1.5 ${
                            i < selected.artifacts.length - 1 ? "border-b border-dashed border-border" : ""
                          }`}
                        >
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-[12px] text-foreground">{a}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[12px] leading-relaxed text-body max-w-[44ch]">{selected.note}</p>
                  </div>

                  {/* Step controls */}
                  <div className="flex md:flex-col items-start md:items-end gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => stepNode(-1)}
                      className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                      aria-label="Previous phase"
                    >
                      <span aria-hidden>←</span> prev
                    </button>
                    <span aria-hidden className="hidden md:block w-6 ctx-dotted" />
                    <button
                      type="button"
                      onClick={() => stepNode(1)}
                      className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                      aria-label="Next phase"
                    >
                      next <span aria-hidden>→</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  5 phases · 12 sources · 0 leaks
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  hash · 0xA42F…91C
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LineageStateChip({ state }: { state: LineageNode["state"] }) {
  const map = {
    captured: { tone: "muted", label: "Read" },
    verified: { tone: "green", label: "Cited" },
    loaded: { tone: "muted", label: "Linked" },
    running: { tone: "amber", label: "Tracing" },
    pending: { tone: "muted", label: "Queued" },
  } as const
  const cfg = map[state]
  const dot =
    cfg.tone === "green" ? "bg-green" : cfg.tone === "amber" ? "bg-amber" : "bg-muted-foreground"
  const text =
    cfg.tone === "green" ? "text-green" : cfg.tone === "amber" ? "text-amber" : "text-muted-foreground"
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${text}`}>
      <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
        {state === "running" && <span className={`absolute inset-0 rounded-full ${dot} ctx-pulse-ring`} />}
        <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${dot} ${state === "running" ? "ctx-pulse" : ""}`} />
      </span>
      {cfg.label}
    </span>
  )
}

/* ───────────────────────── Interpretation Gap (§ 02) ───────────────────────── */

type GapRow = {
  id: string
  reading: string
  said: { who: "A" | "B"; quote: string; source: string }
  heard: { who: "A" | "B"; quote: string }
  translation: string
  trace: {
    driftType: string
    specimen: string
    citations: string[]
    bridge: string
  }
}

const GAP_ROWS: GapRow[] = [
  {
    id: "R-01",
    reading: "Reading 01 · A reads B",
    said: {
      who: "B",
      quote: "I didn't realize that was final. I was trying to help.",
      source: "thread/launch · L148",
    },
    heard: {
      who: "A",
      quote: "You overstepped my ownership of the launch copy.",
    },
    translation: "B was offering assistance, not contesting authority. The frame mismatch is ownership vs. help.",
    trace: {
      driftType: "frame mismatch · ownership/help",
      specimen: "S-02",
      citations: ["thread/launch · L142", "thread/launch · L148"],
      bridge:
        "I think we got crossed on whether you were stepping in or stepping over. Can we agree on the bar together before I finalize?",
    },
  },
  {
    id: "R-02",
    reading: "Reading 02 · B reads A",
    said: {
      who: "A",
      quote: "It felt like you didn't trust me to ship it.",
      source: "thread/launch · L156",
    },
    heard: {
      who: "B",
      quote: "You're accusing me of acting in bad faith.",
    },
    translation: "A was naming a felt absence of trust, not assigning blame. The trigger is affective, not procedural.",
    trace: {
      driftType: "affect · trust-coded",
      specimen: "S-03",
      citations: ["thread/launch · L156", "thread/launch · L161"],
      bridge:
        "I wasn't trying to flag bad faith — I was naming a felt gap in trust. Can you walk me through the move so I can see it your way?",
    },
  },
]

type GapFocus = "all" | "said" | "heard" | "bridge"

function InterpretationGapBlock({
  shown,
  response,
  state,
}: {
  shown: boolean
  response: ContextualRunResponse | null
  state: 'idle' | 'loading' | 'error' | 'success'
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  return (
    <article
      className={`ctx-corners bg-card border border-border rounded-sm overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          05.01 / Interpretation gap
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {state === 'success' ? `${response?.interpretationGaps.length ?? 0} reads` : 'locked until run'}
        </span>
      </header>

      {state !== 'success' || !response ? (
        <div className="px-5 py-6">
          <p className="text-[14px] leading-relaxed text-body max-w-[42rem]">
            This deeper read stays empty until the agent finishes. After the trace completes, cited interpretation gaps from the API response render here.
          </p>
        </div>
      ) : (
        <>
          <ol>
            {response.interpretationGaps.map((gap, index) => {
              const isExpanded = expandedRow === gap.id
              return (
                <li
                  key={gap.id}
                  className={`border-b border-border last:border-b-0 ${shown ? 'ctx-reveal' : 'ctx-pre'}`}
                  style={{ animationDelay: `${320 + index * 120}ms` }}
                >
                  <div className="px-5 py-5 grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {gap.id}
                      </div>
                      <h3 className="mt-2 font-sans text-[16px] leading-tight tracking-tight text-foreground">{gap.title}</h3>
                      <button
                        type="button"
                        onClick={() => setExpandedRow((cur) => (cur === gap.id ? null : gap.id))}
                        aria-expanded={isExpanded}
                        aria-controls={`gap-detail-${gap.id}`}
                        className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                      >
                        <span aria-hidden>{isExpanded ? '▾' : '▸'}</span>
                        {isExpanded ? 'Collapse details' : 'Open details'}
                      </button>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                        Evidence-supported read
                      </div>
                      <p className="text-[14px] leading-relaxed text-foreground">{gap.evidence}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {gap.evidenceCitations.map((citation) => (
                          <span
                            key={citation}
                            className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground border border-border rounded-sm px-2 py-1 bg-background/50"
                          >
                            {citation}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                        Likely interpretation gap
                      </div>
                      <p className="text-[14px] leading-relaxed text-foreground">{gap.interpretation}</p>
                    </div>
                  </div>

                  <div
                    id={`gap-detail-${gap.id}`}
                    className="ctx-expand"
                    data-open={isExpanded ? 'true' : 'false'}
                    aria-hidden={!isExpanded}
                  >
                    <div className="border-t border-border bg-background/60 px-5 py-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                          Uncertainty
                        </div>
                        <p className="text-[13px] leading-relaxed text-foreground">{gap.uncertainty}</p>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                          Support level
                        </div>
                        <p className="text-[13px] leading-relaxed text-foreground">{gap.support}</p>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <footer className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              gap surface · api-backed
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              evidence and interpretation kept separate
            </span>
          </footer>
        </>
      )}
    </article>
  )
}

function GapCell({
  mobileLabel,
  who,
  quote,
  meta,
  metaLabel,
  tone,
}: {
  mobileLabel: string
  who: "A" | "B"
  quote: string
  meta: string
  metaLabel: string
  tone: "evidence" | "received"
}) {
  return (
    <div className="px-4 py-5 md:border-r border-b md:border-b-0 border-border last:border-r-0">
      <div className="md:hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
        {mobileLabel}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Party {who}
        </span>
        <span aria-hidden className="font-mono text-[10px] text-border">·</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {tone === "evidence" ? "spoken" : "interpreted"}
        </span>
      </div>
      <p
        className={`text-[14px] leading-relaxed ${
          tone === "evidence" ? "text-foreground" : "text-body italic"
        }`}
      >
        {tone === "evidence" ? `"${quote}"` : quote}
      </p>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {metaLabel} · {meta}
      </div>
    </div>
  )
}

/* ───────────────────────── Privacy Boundary (§ 04) ───────────────────────── */

type PrivacyItem = { id: string; label: string; detail: string }

const PRIVATE_ITEMS: PrivacyItem[] = [
  { id: "P-01", label: "Private read", detail: "Notes you jot before drafting." },
  { id: "P-02", label: "Frame notes", detail: "Working notes on perceived intent." },
  { id: "P-03", label: "Discarded drafts", detail: "Repair paths you didn't keep." },
  { id: "P-04", label: "Rationale trace", detail: "Why the agent chose this draft." },
]

const SHARED_ITEMS: PrivacyItem[] = [
  { id: "S-01", label: "Cited transcript excerpts", detail: "Verbatim, redacted, signed." },
  { id: "S-02", label: "Signed repair path", detail: "Co-signed before sending." },
  { id: "S-03", label: "Final exchange", detail: "Sent message and acknowledgement." },
  { id: "S-04", label: "Audit trace", detail: "Hashes, timestamps, signatures." },
]

function PrivacyBoundaryBlock({
  shown,
  personAReflection,
  setPersonAReflection,
  personBReflection,
  setPersonBReflection,
}: {
  shown: boolean
  personAReflection: string
  setPersonAReflection: (v: string) => void
  personBReflection: string
  setPersonBReflection: (v: string) => void
}) {
  return (
    <article
      className={`ctx-corners bg-card border border-border rounded-sm overflow-hidden ${shown ? "ctx-reveal" : "ctx-pre"}`}
      style={{ animationDelay: "240ms" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          02.01 / Private reflections — enter freely
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          used as context only
        </span>
      </header>

      {/* Two zones */}
      <div className="relative grid grid-cols-1 md:grid-cols-2">
        {/* Boundary line + label (desktop) */}
        <div
          aria-hidden
          className="hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-foreground/40"
        />
        <span
          aria-hidden
          className="hidden md:flex absolute left-1/2 top-4 -translate-x-1/2 z-10 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground bg-card border border-border px-1.5 py-0.5 rounded-sm"
        >
          <span className="h-1 w-1 rounded-full bg-foreground" />
          Boundary
        </span>

        {/* Person A reflection */}
        <PrivacyInputZone
          shown={shown}
          baseDelay={300}
          align="left"
          eyebrow="Reflection A"
          title="Person A private reflection"
          subtitle="Used as private context only. Not quoted back as shared evidence."
          icon="lock"
          value={personAReflection}
          onChange={setPersonAReflection}
          placeholder="What did you think was happening here? What concern, need, or interpretation felt most important from your side?"
        />

        {/* Person B reflection */}
        <PrivacyInputZone
          shown={shown}
          baseDelay={460}
          align="right"
          eyebrow="Reflection B"
          title="Person B private reflection"
          subtitle="Used as private context only. Not quoted back as shared evidence."
          icon="handshake"
          value={personBReflection}
          onChange={setPersonBReflection}
          placeholder="What did you mean, what did you hear, and what concern or pressure felt most important from your side?"
        />
      </div>

      {/* Boundary statement (mobile) */}
      <div className="md:hidden border-t border-border px-5 py-3 bg-background/40">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          ↑ boundary · enforced at write ↓
        </span>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-5 py-3 border-t border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          private by default
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          used as context · not evidence
        </span>
      </footer>
    </article>
  )
}

function PrivacyInputZone({
  shown,
  baseDelay,
  align,
  eyebrow,
  title,
  subtitle,
  icon,
  value,
  onChange,
  placeholder,
}: {
  shown: boolean
  baseDelay: number
  align: "left" | "right"
  eyebrow: string
  title: string
  subtitle: string
  icon: "lock" | "handshake"
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="p-5 md:p-6 border-b md:border-b-0 border-border last:border-b-0 flex flex-col gap-4">
      <div
        className={`flex items-center justify-between gap-3 ${shown ? "ctx-reveal" : "ctx-pre"}`}
        style={{ animationDelay: `${baseDelay}ms` }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</span>
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center border border-border rounded-sm text-muted-foreground"
        >
          {icon === "lock" ? <LockIcon /> : <HandshakeIcon />}
        </span>
      </div>

      <h3
        className={`font-sans text-[16px] leading-tight tracking-tight text-foreground ${
          shown ? "ctx-reveal" : "ctx-pre"
        }`}
        style={{ animationDelay: `${baseDelay + 60}ms` }}
      >
        {title}
      </h3>
      <p
        className={`text-[13px] leading-relaxed text-body ${shown ? "ctx-reveal" : "ctx-pre"}`}
        style={{ animationDelay: `${baseDelay + 120}ms` }}
      >
        {subtitle}
      </p>

      {/* Textarea input */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-3 w-full min-h-[140px] px-3 py-2.5 bg-background border border-border rounded-sm font-sans text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20 resize-none ${
          shown ? "ctx-reveal" : "ctx-pre"
        }`}
        style={{ animationDelay: `${baseDelay + 200}ms` }}
      />
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
      <rect x="2" y="4.5" width="6" height="4" rx="0.5" />
      <path d="M3.5 4.5 V3 a1.5 1.5 0 0 1 3 0 V4.5" />
    </svg>
  )
}

function HandshakeIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 6.5 L3 4.5 L5 6 L7 4 L9 6" />
      <path d="M1 6.5 H2.5" />
      <path d="M9 6 H11" />
    </svg>
  )
}

/* ───────────────────────── DriftMark — inline glossary popover ───────────────────────── */

/**
 * DriftMark wraps a term in body copy with a subtle dotted underline + tiny "↳" marker.
 * Click or focus opens a small popover with a definition, source pointer, and an "↩ esc" hint.
 * Used to make the page feel inspectable without crowding the prose.
 */
function DriftMark({
  term,
  def,
  cite,
  children,
}: {
  term: string
  def: string
  cite?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Inspect term: ${term}`}
        className={`group inline align-baseline text-foreground border-b border-dotted hover:border-foreground/80 focus:outline-none focus-visible:border-foreground transition-colors ${
          open ? "border-foreground" : "border-foreground/35"
        }`}
      >
        {children}
        <sup
          aria-hidden
          className="ml-0.5 font-mono text-[9px] tracking-tight text-muted-foreground group-hover:text-foreground transition-colors"
        >
          ↳
        </sup>
      </button>
      {open && (
        <span
          role="tooltip"
          className="ctx-fade absolute left-0 top-full mt-2 z-30 w-[280px] max-w-[80vw] bg-card border border-border rounded-sm shadow-sm p-3 text-left"
        >
          <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
            term · {term}
          </span>
          <span className="block font-sans text-[13px] leading-relaxed text-foreground">{def}</span>
          <span className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>{cite ?? "in this document"}</span>
            <span aria-hidden>↩ esc</span>
          </span>
        </span>
      )}
    </span>
  )
}

/* ───────────────────────── Section Glyphs — small weird system marks ───────────────────────── */

/**
 * SectionGlyph renders a tiny, monochrome SVG cipher unique to each phase.
 * Each glyph is a graphic restatement of the section's role:
 *   00  rupture mark — bracketed point, where the conversation broke
 *   01  registration — corner ticks + crosshair, lines aligning to source
 *   02  drift vector — two arrowheads converging on a dashed origin
 *   03  forking path — branching candidates from a single node
 *   04  boundary spine — a vertical with mirrored triangles on each side
 *   05  sealed ring — closed circle with a small notch and inner dot
 */
function SectionGlyph({ n, className = "text-foreground/70" }: { n: string; className?: string }) {
  const inner = (() => {
    switch (n) {
      case "00":
        return (
          <>
            <path d="M3 2 L1 2 L1 12 L3 12" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M11 2 L13 2 L13 12 L11 12" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="7" cy="7" r="1.25" fill="currentColor" />
          </>
        )
      case "01":
        return (
          <>
            <path d="M2 5 L2 2 L5 2" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M9 2 L12 2 L12 5" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M12 9 L12 12 L9 12" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M5 12 L2 12 L2 9" stroke="currentColor" strokeWidth="1" fill="none" />
            <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1" />
            <line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" strokeWidth="1" />
          </>
        )
      case "02":
        return (
          <>
            <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
            <path d="M2 7 L5 7 M5 7 L4 5.5 M5 7 L4 8.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M12 7 L9 7 M9 7 L10 5.5 M9 7 L10 8.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          </>
        )
      case "03":
        return (
          <>
            <line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" strokeWidth="1" />
            <line x1="7" y1="6" x2="3" y2="12" stroke="currentColor" strokeWidth="1" />
            <line x1="7" y1="6" x2="11" y2="12" stroke="currentColor" strokeWidth="1" />
            <circle cx="7" cy="6" r="1" fill="currentColor" />
            <circle cx="3" cy="12" r="0.75" fill="currentColor" />
            <circle cx="11" cy="12" r="0.75" fill="currentColor" />
          </>
        )
      case "04":
        return (
          <>
            <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" />
            <path d="M3 5 L6 7 L3 9 Z" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M11 5 L8 7 L11 9 Z" stroke="currentColor" strokeWidth="1" fill="none" />
          </>
        )
      case "05":
        return (
          <>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1" fill="none" />
            <line x1="7" y1="2.5" x2="7" y2="4.5" stroke="currentColor" strokeWidth="1" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
          </>
        )
      default:
        return null
    }
  })()
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className={className}>
      {inner}
    </svg>
  )
}

/* ───────────────────────── Section Interstitial — diagram fragments between sections ───────────────────────── */

/**
 * SectionInterstitial renders a small diagram fragment in the band between two sections.
 * Each fragment is a different graphical motif (coordinate cross, concentric rings,
 * paired brackets, chevron run, dotted spine) so the rhythm between phases feels
 * like turning a page in a survey atlas.
 */
function SectionInterstitial({ from }: { from: string }) {
  const frag = (() => {
    switch (from) {
      case "00":
        return (
          <svg viewBox="0 0 80 12" className="h-3 w-20 text-foreground/35" aria-hidden>
            <line x1="0" y1="6" x2="80" y2="6" stroke="currentColor" strokeWidth="1" />
            {[14, 28, 40, 52, 66].map((x) => (
              <g key={x} stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                <line x1={x - 2} y1="6" x2={x + 2} y2="6" />
                <line x1={x} y1="3" x2={x} y2="9" />
              </g>
            ))}
          </svg>
        )
      case "01":
        return (
          <svg viewBox="0 0 80 14" className="h-3.5 w-20 text-foreground/35" aria-hidden>
            <line x1="0" y1="7" x2="28" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
            <line x1="52" y1="7" x2="80" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx="40" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="40" cy="7" r="2.5" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="40" cy="7" r="0.8" fill="currentColor" />
          </svg>
        )
      case "02":
        return (
          <svg viewBox="0 0 100 12" className="h-3 w-[100px] text-foreground/35" aria-hidden>
            <path d="M5 2 L1 6 L5 10" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M95 2 L99 6 L95 10" stroke="currentColor" strokeWidth="1" fill="none" />
            <line x1="10" y1="6" x2="90" y2="6" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx="50" cy="6" r="1.5" fill="currentColor" />
            <line x1="42" y1="6" x2="46" y2="6" stroke="currentColor" strokeWidth="1" />
            <line x1="54" y1="6" x2="58" y2="6" stroke="currentColor" strokeWidth="1" />
          </svg>
        )
      case "03":
        return (
          <svg viewBox="0 0 100 12" className="h-3 w-[100px] text-foreground/35" aria-hidden>
            {[14, 30, 46, 62, 78].map((x) => (
              <path
                key={x}
                d={`M${x - 3} 3 L${x} 6 L${x - 3} 9`}
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            <line x1="86" y1="6" x2="98" y2="6" stroke="currentColor" strokeWidth="1" />
          </svg>
        )
      case "04":
        return (
          <svg viewBox="0 0 100 12" className="h-3 w-[100px] text-foreground/35" aria-hidden>
            <line x1="6" y1="6" x2="94" y2="6" stroke="currentColor" strokeWidth="1" />
            <circle cx="6" cy="6" r="1.75" fill="currentColor" />
            <circle cx="94" cy="6" r="1.75" fill="currentColor" />
            <line x1="50" y1="2" x2="50" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
            <circle cx="50" cy="6" r="1" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        )
      default:
        return null
    }
  })()
  if (!frag) return null
  return (
    <div className="border-t border-border" aria-hidden>
      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-3 flex items-center justify-center gap-3">
        <span className="block h-px w-8 bg-border" />
        {frag}
        <span className="block h-px w-8 bg-border" />
      </div>
    </div>
  )
}

/* ───────────────────────── Drift Cartograph — signal map of frames ───────────────────────── */

type CartoKind = "intent" | "received" | "centroid" | "bridge"
type CartoPoint = {
  id: string
  who: "A" | "B" | "shared"
  kind: CartoKind
  label: string
  detail: string
  source: string
  nx: number // -1..1 — frame: ownership(-) ↔ help(+)
  ny: number // -1..1 — affect: procedural(-) ↑ trust-coded(+)
}

const CARTO_POINTS: CartoPoint[] = [
  {
    id: "a-int",
    who: "A",
    kind: "intent",
    label: "A · intent",
    detail: "Frame ownership of the launch copy as authority — protect the bar.",
    source: "thread/launch · L142",
    nx: -0.65,
    ny: -0.55,
  },
  {
    id: "a-rec",
    who: "A",
    kind: "received",
    label: "A · received",
    detail: "Read B's deadline as a deliverable. Heard the absence of trust before procedure.",
    source: "thread/launch · L156",
    nx: -0.5,
    ny: 0.65,
  },
  {
    id: "b-int",
    who: "B",
    kind: "intent",
    label: "B · intent",
    detail: "Offer a checkpoint, assist on the launch — help, not authority.",
    source: "thread/launch · L98",
    nx: 0.55,
    ny: -0.45,
  },
  {
    id: "b-rec",
    who: "B",
    kind: "received",
    label: "B · received",
    detail: "Heard A as flagging bad faith on procedure — defaulted to defense.",
    source: "thread/launch · L161",
    nx: -0.3,
    ny: -0.4,
  },
  {
    id: "centroid",
    who: "shared",
    kind: "centroid",
    label: "gap centroid",
    detail: "Midpoint of the four reads. Where the conversation is actually sitting.",
    source: "computed · 02.01",
    nx: -0.075,
    ny: -0.19,
  },
  {
    id: "bridge",
    who: "shared",
    kind: "bridge",
    label: "bridge target",
    detail: "A move that closes both drift vectors. Cited to the lines it bridges.",
    source: "draft · v0.1",
    nx: 0.1,
    ny: -0.1,
  },
]

const CARTO_VECTORS: { id: string; who: "A" | "B"; from: string; to: string }[] = [
  { id: "vec-A", who: "A", from: "a-int", to: "a-rec" },
  { id: "vec-B", who: "B", from: "b-int", to: "b-rec" },
]

function DriftCartograph() {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string>("centroid")
  const activeId = hoverId ?? pinnedId
  const active = CARTO_POINTS.find((p) => p.id === activeId) ?? CARTO_POINTS[4]

  // Plot area: 40..560 × 24..204 (520 × 180)
  const W = 600
  const H = 240
  const cx = 300
  const cy = 114 // (24+204)/2
  const xRange = 260
  const yRange = 90
  const px = (nx: number) => cx + nx * xRange
  const py = (ny: number) => cy - ny * yRange

  return (
    <section
      aria-labelledby="cartograph-heading"
      className="border-b border-border"
    >
      {/* Sub-header */}
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-background/40">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          02.00 / Drift cartograph — frame × affect
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {CARTO_POINTS.length} points · 2 vectors
        </span>
      </header>

      {/* The map */}
      <div className="px-5 py-5">
        <h3 id="cartograph-heading" className="sr-only">
          Drift cartograph
        </h3>
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full h-auto"
            role="img"
            aria-label="Two-dimensional plot of party intents and receptions across frame and affect axes"
          >
            {/* Plot border */}
            <rect
              x="40"
              y="24"
              width="520"
              height="180"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="1"
            />

            {/* Crosshair through origin */}
            <line
              x1="40"
              y1={cy}
              x2="560"
              y2={cy}
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <line
              x1={cx}
              y1="24"
              x2={cx}
              y2="204"
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />

            {/* Plotted markers — small + ticks at intersections */}
            {[-0.66, -0.33, 0, 0.33, 0.66].map((nx) =>
              [-0.66, -0.33, 0, 0.33, 0.66].map((ny) => {
                if (nx === 0 || ny === 0) return null
                const x = px(nx)
                const y = py(ny)
                return (
                  <g key={`m-${nx}-${ny}`} stroke="var(--color-border)" strokeWidth="1" strokeLinecap="round">
                    <line x1={x - 2.5} y1={y} x2={x + 2.5} y2={y} />
                    <line x1={x} y1={y - 2.5} x2={x} y2={y + 2.5} />
                  </g>
                )
              }),
            )}

            {/* Quadrant labels */}
            <g className="font-mono" style={{ fontSize: 9 }} fill="var(--color-muted-foreground)">
              <text x="48" y="36" letterSpacing="1">trust-coded · ownership</text>
              <text x="552" y="36" textAnchor="end" letterSpacing="1">trust-coded · help</text>
              <text x="48" y="198" letterSpacing="1">procedural · ownership</text>
              <text x="552" y="198" textAnchor="end" letterSpacing="1">procedural · help</text>
            </g>

            {/* Axis ticks */}
            <g className="font-mono" style={{ fontSize: 9 }} fill="var(--color-muted-foreground)" letterSpacing="1">
              <text x="40" y="220" textAnchor="start">← ownership</text>
              <text x="560" y="220" textAnchor="end">help →</text>
              <text x="40" y="20" textAnchor="start">↑ trust-coded</text>
              <text x="560" y="20" textAnchor="end">procedural ↓</text>
            </g>

            {/* Drift vectors — thin dashed connectors with arrowhead at received end */}
            <defs>
              <marker
                id="cart-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L8 5 L0 10 Z" fill="var(--color-foreground)" />
              </marker>
              <marker
                id="cart-arrow-muted"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L8 5 L0 10 Z" fill="var(--color-muted-foreground)" />
              </marker>
            </defs>

            {CARTO_VECTORS.map((v) => {
              const from = CARTO_POINTS.find((p) => p.id === v.from)!
              const to = CARTO_POINTS.find((p) => p.id === v.to)!
              const isA = v.who === "A"
              return (
                <g key={v.id}>
                  <line
                    x1={px(from.nx)}
                    y1={py(from.ny)}
                    x2={px(to.nx)}
                    y2={py(to.ny)}
                    stroke={isA ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    markerEnd={isA ? "url(#cart-arrow)" : "url(#cart-arrow-muted)"}
                  />
                  {/* Vector label at midpoint */}
                  <text
                    x={(px(from.nx) + px(to.nx)) / 2}
                    y={(py(from.ny) + py(to.ny)) / 2 - 5}
                    fill="var(--color-muted-foreground)"
                    className="font-mono"
                    style={{ fontSize: 9 }}
                    letterSpacing="1"
                    textAnchor="middle"
                  >
                    drift · {v.who}
                  </text>
                </g>
              )
            })}

            {/* Plotted points — distinct shape per kind */}
            {CARTO_POINTS.map((p) => {
              const x = px(p.nx)
              const y = py(p.ny)
              const isActive = p.id === active.id
              const fill =
                p.kind === "intent"
                  ? "transparent"
                  : p.kind === "received"
                    ? "var(--color-foreground)"
                    : p.kind === "centroid"
                      ? "transparent"
                      : "transparent"
              const stroke = "var(--color-foreground)"
              const shape = (() => {
                if (p.kind === "intent") {
                  // hollow square
                  return <rect x={x - 4} y={y - 4} width="8" height="8" fill={fill} stroke={stroke} strokeWidth="1" />
                }
                if (p.kind === "received") {
                  // filled diamond
                  return (
                    <path
                      d={`M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y} Z`}
                      fill={stroke}
                      stroke={stroke}
                      strokeWidth="1"
                    />
                  )
                }
                if (p.kind === "centroid") {
                  // open circle with crosshair
                  return (
                    <g>
                      <circle cx={x} cy={y} r="5" fill="var(--color-card)" stroke={stroke} strokeWidth="1" />
                      <line x1={x - 3} y1={y} x2={x + 3} y2={y} stroke={stroke} strokeWidth="1" />
                      <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke={stroke} strokeWidth="1" />
                    </g>
                  )
                }
                // bridge — concentric target rings
                return (
                  <g>
                    <circle cx={x} cy={y} r="7" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx={x} cy={y} r="3.5" fill="var(--color-card)" stroke={stroke} strokeWidth="1" />
                    <circle cx={x} cy={y} r="1.25" fill={stroke} />
                  </g>
                )
              })()
              return (
                <g
                  key={p.id}
                  className="cursor-pointer ctx-cartopoint"
                  onMouseEnter={() => setHoverId(p.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => {
                    setPinnedId(p.id)
                    setHoverId(null)
                  }}
                  onFocus={() => setHoverId(p.id)}
                  onBlur={() => setHoverId(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label} — ${p.detail}`}
                >
                  {/* Hit target */}
                  <circle cx={x} cy={y} r="14" fill="transparent" />
                  {/* Active halo + axis projection guides — drawn only when active */}
                  {isActive && (
                    <g key={`active-${p.id}`}>
                      {/* X-axis projection */}
                      <line
                        x1={x}
                        y1={y}
                        x2={x}
                        y2={204}
                        stroke="var(--color-foreground)"
                        strokeWidth="1"
                        strokeDasharray="2 3"
                        opacity="0.55"
                        className="ctx-stroke"
                        style={
                          {
                            "--ctx-dash": `${Math.abs(204 - y)}`,
                            "--ctx-delay": "60ms",
                          } as React.CSSProperties
                        }
                      />
                      {/* Y-axis projection */}
                      <line
                        x1={x}
                        y1={y}
                        x2={40}
                        y2={y}
                        stroke="var(--color-foreground)"
                        strokeWidth="1"
                        strokeDasharray="2 3"
                        opacity="0.55"
                        className="ctx-stroke"
                        style={
                          {
                            "--ctx-dash": `${Math.abs(x - 40)}`,
                            "--ctx-delay": "60ms",
                          } as React.CSSProperties
                        }
                      />
                      {/* Tick marks at axis intersections */}
                      <g stroke="var(--color-foreground)" strokeWidth="1" className="ctx-fade">
                        <line x1={x - 3} y1="204" x2={x + 3} y2="204" />
                        <line x1="40" y1={y - 3} x2="40" y2={y + 3} />
                      </g>
                      {/* Coordinate readouts at the axes */}
                      <g
                        className="ctx-fade"
                        fill="var(--color-foreground)"
                        style={{ fontSize: 9 }}
                      >
                        <text
                          x={x}
                          y="216"
                          textAnchor="middle"
                          className="font-mono"
                          letterSpacing="1"
                        >
                          {p.nx >= 0 ? "+" : ""}
                          {p.nx.toFixed(2)}
                        </text>
                        <text
                          x="34"
                          y={y + 3}
                          textAnchor="end"
                          className="font-mono"
                          letterSpacing="1"
                        >
                          {p.ny >= 0 ? "+" : ""}
                          {p.ny.toFixed(2)}
                        </text>
                      </g>
                      {/* Halo ring */}
                      <circle
                        cx={x}
                        cy={y}
                        r="11"
                        fill="none"
                        stroke="var(--color-foreground)"
                        strokeWidth="1"
                        strokeDasharray="1.5 2"
                      />
                    </g>
                  )}
                  {shape}
                  {/* Label tag */}
                  <text
                    x={x + 9}
                    y={y - 8}
                    fill="var(--color-foreground)"
                    className="font-mono"
                    style={{ fontSize: 9 }}
                    letterSpacing="1"
                  >
                    {p.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Readout — selected point detail */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-x-6 gap-y-2 border-t border-dashed border-border pt-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {pinnedId === activeId ? "pinned" : "preview"}
            </span>
            <span className="font-mono text-[12px] text-foreground">{active.label}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              kind · {active.kind}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground max-w-[52ch]">{active.detail}</p>
          <div className="flex flex-col gap-1 md:items-end font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>
              source · <span className="text-foreground">{active.source}</span>
            </span>
            <span className="tabular-nums">
              x {active.nx >= 0 ? "+" : ""}
              {active.nx.toFixed(2)} · y {active.ny >= 0 ? "+" : ""}
              {active.ny.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Legend strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/40 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
            intent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M5 0 L10 5 L5 10 L0 5 Z" fill="currentColor" />
            </svg>
            received
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="2" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1" />
              <line x1="5" y1="2" x2="5" y2="8" stroke="currentColor" strokeWidth="1" />
            </svg>
            centroid
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden>
              <circle cx="6" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
              <circle cx="6" cy="5" r="1.5" fill="currentColor" />
            </svg>
            bridge
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="6" viewBox="0 0 20 6" aria-hidden>
              <line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
            drift vector
          </span>
        </div>
        <span>hover · click to pin</span>
      </div>
    </section>
  )
}

/* ───────────────────────── Cipher Index — decodes the section glyphs ───────────────────────── */

const CIPHER_INDEX: { n: string; name: string; gloss: string }[] = [
  { n: "00", name: "gap mark", gloss: "where the conversation first went off track" },
  { n: "01", name: "registration", gloss: "every line aligns to its source — corner ticks + crosshair" },
  { n: "02", name: "drift vector", gloss: "two frames meeting at origin — opposing arrowheads" },
  { n: "03", name: "forking path", gloss: "branching candidates from a single node" },
  { n: "04", name: "boundary spine", gloss: "what crosses, what stays — vertical with mirrored triangles" },
  { n: "05", name: "sealed ring", gloss: "the trace, closed and signed — circle with notch" },
]

function CipherIndex() {
  return (
    <section aria-labelledby="cipher-index-heading" className="mt-10">
      <div aria-hidden className="ctx-dotted" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3
          id="cipher-index-heading"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Index of marks
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {CIPHER_INDEX.length} marks · 0 explained twice
        </span>
      </div>
      <ol
        className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 ctx-stagger"
        style={{ "--ctx-step": "55ms" } as React.CSSProperties}
      >
        {CIPHER_INDEX.map((c, i) => (
          <li
            key={c.n}
            className="ctx-fade-up grid grid-cols-[24px_56px_1fr] items-baseline gap-3 border-t border-dashed border-border pt-2 group"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="self-center inline-flex items-center justify-center transition-transform duration-200 ease-out group-hover:-translate-y-px">
              <SectionGlyph n={c.n} className="text-foreground" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              § {c.n}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">{c.name}</span>
              <span className="font-sans text-[12px] leading-snug text-body">{c.gloss}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border bg-card/40">
      {/* Tick ruler — closes the document */}
      <div aria-hidden className="ctx-ticks mx-auto max-w-[1320px] px-6 md:px-10" />

      <div className="mx-auto max-w-[1320px] px-6 md:px-10 py-12 md:py-16">
        <div className="grid grid-cols-12 gap-x-8 gap-y-8">
          {/* Left marker */}
          <div className="col-span-12 md:col-span-2">
            <div className="flex md:flex-col items-baseline md:items-start gap-3 md:gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                §§
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                System notes
              </div>
              <div aria-hidden className="hidden md:block w-12 ctx-dotted mt-2" />
            </div>
          </div>

          {/* Body */}
          <div className="col-span-12 md:col-span-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Document
                </div>
                <p className="text-[13px] leading-relaxed text-body max-w-[28ch]">
                  Set in Geist · ruled in 24px grid · printed in editorial mono.
                </p>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  System
                </div>
                <ul className="font-mono text-[11px] text-foreground flex flex-col gap-1">
                  <li>contextual.read · v0.5.0</li>
                  <li>build · 2026.05.02</li>
                  <li>hash · 0xA42F…91C</li>
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Session
                </div>
                <ul className="font-mono text-[11px] text-foreground flex flex-col gap-1">
                  <li>session 01 · sealed on review</li>
                  <li>2 parties · 1 incident · 12 sources</li>
                  <li>0 leaks · 0 paraphrase</li>
                </ul>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Field notes
                </div>
                <ul className="font-mono text-[11px] text-foreground flex flex-col gap-1">
                  <li>1. cite, do not paraphrase</li>
                  <li>2. surface, do not arbitrate</li>
                  <li>3. sign, do not assume</li>
                </ul>
              </div>
            </div>

            {/* Index of marks — decodes the section ciphers used throughout the document */}
            <CipherIndex />

            <div aria-hidden className="ctx-dotted mt-10" />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Contextual / evidence-aware mediation</span>
              <span aria-hidden className="hidden md:inline">↳ read the record, review the repair</span>
              <span>© 2026</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
