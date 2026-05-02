/**
 * Shared types for the contextual agent system.
 * Used across API routes, server functions, and client components.
 */

export interface ContextualRunRequest {
  personAReflection: string
  personBReflection: string
  sharedEvidence: string
  usePublicContext: boolean
}

export type TraceStepStatus = 'done' | 'active' | 'queued' | 'skipped'

export type SupportLevel = 'strong' | 'moderate' | 'limited'

export interface TraceStep {
  id: string
  label: string
  status: TraceStepStatus
  tool: string
  detail: string
}

export interface EvidenceHighlight {
  citation: string
  lineNumber: number
  speaker: string | null
  quote: string
  observation: string
  support: SupportLevel
}

export interface SignalDetected {
  type:
    | 'ambiguity'
    | 'assumption'
    | 'defensiveness'
    | 'delayed_acknowledgement'
    | 'escalation'
    | 'question_response_mismatch'
  citations: string[]
  detail: string
  support: SupportLevel
}

export interface InterpretationGap {
  id: string
  title: string
  evidenceCitations: string[]
  evidence: string
  interpretation: string
  uncertainty: string
  support: SupportLevel
}

export interface UncertaintyNote {
  issue: string
  detail: string
  citations: string[]
}

export interface PublicContextArtifact {
  sourceType: 'url' | 'mcp'
  source: string
  title: string
  snippet: string
  support: SupportLevel
}

export interface PublicContextDecision {
  requested: boolean
  relevant: boolean
  decision: 'skip' | 'recommend' | 'used'
  rationale: string
  suggestedTopics: string[]
}

export interface ContextualRunResponse {
  consentStatus: string
  signalSummary: string
  whatBroke: string
  interpretationGap: string
  publicContextCheck: string
  repairStarterA: string
  repairStarterB: string
  evidenceHighlights: EvidenceHighlight[]
  signalsDetected: SignalDetected[]
  interpretationGaps: InterpretationGap[]
  uncertainties: UncertaintyNote[]
  repairRationale: string
  publicContextDecision: PublicContextDecision
  publicContextArtifacts: PublicContextArtifact[]
  trace: TraceStep[]
}
