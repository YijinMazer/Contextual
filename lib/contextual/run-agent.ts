import {
  ContextualRunRequest,
  ContextualRunResponse,
  EvidenceHighlight,
  InterpretationGap,
  PublicContextArtifact,
  PublicContextDecision,
  SignalDetected,
  TraceStep,
  UncertaintyNote,
} from './types'
import { lookupPublicContext } from './tools'

type Party = 'A' | 'B'

type ConcernKey =
  | 'clarity'
  | 'respect'
  | 'reliability'
  | 'fairness'
  | 'autonomy'
  | 'belonging'

interface ReflectionProfile {
  party: Party
  wordCount: number
  inferenceMarkers: number
  uncertaintyMarkers: number
  topConcerns: ConcernKey[]
}

interface EvidenceUnit {
  citation: string
  lineNumber: number
  speaker: string | null
  content: string
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'i',
  'if',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'so',
  'that',
  'the',
  'their',
  'them',
  'there',
  'they',
  'this',
  'to',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'with',
  'you',
  'your',
])

const CONCERN_DEFINITIONS: Array<{ key: ConcernKey; label: string; patterns: RegExp[] }> = [
  {
    key: 'clarity',
    label: 'clarity',
    patterns: [/clear/i, /clarify/i, /confus/i, /understand/i, /mixed signal/i, /specific/i],
  },
  {
    key: 'respect',
    label: 'respect',
    patterns: [/respect/i, /dismiss/i, /ignored/i, /tone/i, /rude/i, /talked over/i, /brushed off/i],
  },
  {
    key: 'reliability',
    label: 'reliability',
    patterns: [/late/i, /delay/i, /reply/i, /respond/i, /follow through/i, /deadline/i, /show up/i],
  },
  {
    key: 'fairness',
    label: 'fairness',
    patterns: [/fair/i, /blame/i, /fault/i, /credit/i, /responsib/i, /unfair/i],
  },
  {
    key: 'autonomy',
    label: 'autonomy',
    patterns: [/pressured/i, /control/i, /space/i, /choice/i, /decide/i, /pushed/i],
  },
  {
    key: 'belonging',
    label: 'inclusion',
    patterns: [/included/i, /excluded/i, /left out/i, /belong/i, /team/i, /supported/i],
  },
]

const PUBLIC_CONTEXT_TOPICS: Array<{ topic: string; patterns: RegExp[] }> = [
  { topic: 'event rules', patterns: [/ticket/i, /venue/i, /event/i, /entry/i, /dress code/i, /schedule/i] },
  { topic: 'pricing', patterns: [/price/i, /pricing/i, /cost/i, /fee/i, /charge/i, /invoice/i, /refund/i] },
  { topic: 'availability', patterns: [/available/i, /availability/i, /book/i, /reservation/i, /slot/i, /inventory/i, /in stock/i] },
  { topic: 'reviews', patterns: [/review/i, /rating/i, /stars/i, /feedback score/i] },
  { topic: 'delays', patterns: [/delay/i, /late/i, /eta/i, /delivery/i, /shipment/i, /arriv/i] },
  { topic: 'policies', patterns: [/policy/i, /guideline/i, /rule/i, /terms/i, /allowed/i, /requirement/i] },
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').trim()
}

function clip(text: string, max = 160): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function concernLabel(key: ConcernKey): string {
  return CONCERN_DEFINITIONS.find((item) => item.key === key)?.label ?? key
}

function parseReflection(reflection: string, party: Party): ReflectionProfile {
  const normalized = normalizeWhitespace(reflection)
  const lower = normalized.toLowerCase()
  const wordCount = normalized ? normalized.split(/\s+/).length : 0
  const concernScores = CONCERN_DEFINITIONS.map((definition) => ({
    key: definition.key,
    score: definition.patterns.reduce((sum, pattern) => sum + countMatches(lower, pattern), 0),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return {
    party,
    wordCount,
    inferenceMarkers: countMatches(
      lower,
      /\b(think|thought|feel|felt|believe|assume|assumed|seem|seemed|meant|intended|trying to|wanted to|ignored|dismissed)\b/g,
    ),
    uncertaintyMarkers: countMatches(lower, /\b(maybe|might|possibly|not sure|unclear|seems)\b/g),
    topConcerns: concernScores.slice(0, 2).map((item) => item.key),
  }
}

function parseSharedEvidence(sharedEvidence: string): EvidenceUnit[] {
  return normalizeWhitespace(sharedEvidence)
    .split('\n')
    .map((rawLine, index) => ({ rawLine, lineNumber: index + 1 }))
    .filter(({ rawLine }) => rawLine.trim())
    .map(({ rawLine, lineNumber }) => {
      const line = rawLine.trim()
      const match = line.match(/^\s*(?:\[[^\]]+\]\s*)?([^:]{1,30}):\s*(.+)$/)

      return {
        citation: `L${lineNumber}`,
        lineNumber,
        speaker: match ? match[1].trim() : null,
        content: match ? match[2].trim() : line,
      }
    })
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

function lexicalOverlap(a: string, b: string): number {
  const aTokens = new Set(tokenize(a))
  const bTokens = new Set(tokenize(b))
  let overlap = 0

  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap
}

function speakerChanged(current: EvidenceUnit, next: EvidenceUnit): boolean {
  if (!current.speaker || !next.speaker) return true
  return current.speaker.toLowerCase() !== next.speaker.toLowerCase()
}

function addSignal(signals: SignalDetected[], signal: SignalDetected) {
  const key = `${signal.type}:${signal.citations.join(',')}:${signal.detail}`
  if (!signals.some((existing) => `${existing.type}:${existing.citations.join(',')}:${existing.detail}` === key)) {
    signals.push(signal)
  }
}

function detectSignals(units: EvidenceUnit[]): SignalDetected[] {
  const signals: SignalDetected[] = []

  units.forEach((unit, index) => {
    const lower = unit.content.toLowerCase()

    if (/\b(maybe|probably|later|soon|fine|whatever|sometime|i guess)\b/.test(lower)) {
      addSignal(signals, {
        type: 'ambiguity',
        citations: [unit.citation],
        detail: `The wording at ${unit.citation} is vague enough to support more than one read.`,
        support: 'moderate',
      })
    }

    if (/\b(you knew|you should have|obviously|clearly|i thought you|i assumed|supposed to)\b/.test(lower)) {
      addSignal(signals, {
        type: 'assumption',
        citations: [unit.citation],
        detail: `The line at ${unit.citation} assumes shared knowledge or intent rather than checking it.`,
        support: 'moderate',
      })
    }

    if (/\b(actually|i already|i did|i didn't|that's not what|i never|i was just|not my fault)\b/.test(lower)) {
      addSignal(signals, {
        type: 'defensiveness',
        citations: [unit.citation],
        detail: `The reply at ${unit.citation} shifts toward self-protection, which can make clarification harder.`,
        support: 'moderate',
      })
    }

    if (/!{2,}|\b(always|never|ridiculous|unacceptable|absurd)\b/.test(lower) || /[A-Z]{4,}/.test(unit.content)) {
      addSignal(signals, {
        type: 'escalation',
        citations: [unit.citation],
        detail: `The wording at ${unit.citation} raises intensity through absolutes, emphasis, or heightened language.`,
        support: 'strong',
      })
    }

    if (!unit.content.includes('?')) {
      return
    }

    const nextIndex = units.findIndex((candidate, candidateIndex) => candidateIndex > index && speakerChanged(unit, candidate))
    if (nextIndex === -1) {
      addSignal(signals, {
        type: 'delayed_acknowledgement',
        citations: [unit.citation],
        detail: `A direct question appears at ${unit.citation}, but the shared record does not show a clear reply afterward.`,
        support: 'limited',
      })
      return
    }

    const nextUnit = units[nextIndex]
    if (nextIndex - index > 1) {
      addSignal(signals, {
        type: 'delayed_acknowledgement',
        citations: [unit.citation, nextUnit.citation],
        detail: `The question at ${unit.citation} is not picked up until ${nextUnit.citation}, which may have widened the gap.`,
        support: 'moderate',
      })
    }

    const overlap = lexicalOverlap(unit.content, nextUnit.content)
    const looksLikeAnswer = /\b(yes|no|because|will|won't|can|can't|did|didn't|tomorrow|today|later|sorry)\b/.test(
      nextUnit.content.toLowerCase(),
    )

    if (overlap === 0 && !looksLikeAnswer) {
      addSignal(signals, {
        type: 'question_response_mismatch',
        citations: [unit.citation, nextUnit.citation],
        detail: `The reply at ${nextUnit.citation} seems to answer a different point than the question at ${unit.citation}.`,
        support: 'moderate',
      })
    }
  })

  return signals
}

function buildEvidenceHighlights(units: EvidenceUnit[], signals: SignalDetected[]): EvidenceHighlight[] {
  const prioritizedCitations = unique(signals.flatMap((signal) => signal.citations))
  const selectedUnits = prioritizedCitations.length
    ? prioritizedCitations
        .map((citation) => units.find((unit) => unit.citation === citation))
        .filter((unit): unit is EvidenceUnit => Boolean(unit))
        .slice(0, 5)
    : units.slice(0, Math.min(3, units.length))

  return selectedUnits.map((unit) => {
    const relatedSignal = signals.find((signal) => signal.citations.includes(unit.citation))
    return {
      citation: unit.citation,
      lineNumber: unit.lineNumber,
      speaker: unit.speaker,
      quote: clip(unit.content, 140),
      observation:
        relatedSignal?.detail ??
        `The line at ${unit.citation} is part of the shared record, but there is not enough support to make a stronger claim from it alone.`,
      support: relatedSignal?.support ?? 'limited',
    }
  })
}

function signalSummaryLabel(type: SignalDetected['type']): string {
  switch (type) {
    case 'ambiguity':
      return 'ambiguity'
    case 'assumption':
      return 'assumption'
    case 'defensiveness':
      return 'defensiveness'
    case 'delayed_acknowledgement':
      return 'delayed acknowledgement'
    case 'escalation':
      return 'escalation'
    case 'question_response_mismatch':
      return 'question/response mismatch'
  }
}

function buildInterpretationGaps(
  signals: SignalDetected[],
  units: EvidenceUnit[],
  reflectionA: ReflectionProfile,
  reflectionB: ReflectionProfile,
): InterpretationGap[] {
  const gaps: InterpretationGap[] = []

  const mismatch = signals.find((signal) => signal.type === 'question_response_mismatch')
  if (mismatch) {
    gaps.push({
      id: 'gap-1',
      title: 'Different questions may have been answered',
      evidenceCitations: mismatch.citations,
      evidence: `The shared record shows a question-and-reply pair around ${formatList(mismatch.citations)} that do not clearly line up.`,
      interpretation:
        'One person may have been asking for acknowledgement or clarification while the other answered a narrower factual point. That can leave both sides feeling unheard without proving bad intent.',
      uncertainty: 'The mismatch is observable in the record, but the reason for it is not.',
      support: mismatch.support,
    })
  }

  const ambiguityOrAssumption = signals.find(
    (signal) => signal.type === 'ambiguity' || signal.type === 'assumption',
  )
  if (ambiguityOrAssumption) {
    gaps.push({
      id: 'gap-2',
      title: 'Ambiguous wording likely invited inference',
      evidenceCitations: ambiguityOrAssumption.citations,
      evidence: `At ${formatList(ambiguityOrAssumption.citations)}, the wording leaves room for more than one interpretation or assumes shared understanding.`,
      interpretation:
        'That kind of wording often pushes people to fill in meaning on their own, especially about intent, priority, or tone.',
      uncertainty: 'The record supports ambiguity; it does not prove which inferred meaning is correct.',
      support: ambiguityOrAssumption.support,
    })
  }

  const defensiveOrEscalated = signals.find(
    (signal) => signal.type === 'defensiveness' || signal.type === 'escalation',
  )
  if (defensiveOrEscalated) {
    gaps.push({
      id: 'gap-3',
      title: 'Clarification may have been replaced by protection',
      evidenceCitations: defensiveOrEscalated.citations,
      evidence: `The language at ${formatList(defensiveOrEscalated.citations)} becomes more protective or more intense.`,
      interpretation:
        'Once replies start defending the self or using absolutes, it becomes easier to argue about tone and motive than about the original issue.',
      uncertainty: 'The shift in tone is visible; what each person intended by it is not.',
      support: defensiveOrEscalated.support,
    })
  }

  const aConcern = reflectionA.topConcerns[0]
  const bConcern = reflectionB.topConcerns[0]
  if (aConcern && bConcern && aConcern !== bConcern) {
    gaps.push({
      id: 'gap-4',
      title: 'The private concerns may not match',
      evidenceCitations: units.slice(0, Math.min(2, units.length)).map((unit) => unit.citation),
      evidence: 'The shared record shows the exchange itself, but not the full stake each person was protecting.',
      interpretation: `The private reflections suggest Person A may be tracking ${concernLabel(aConcern)} while Person B may be tracking ${concernLabel(bConcern)}. Different stakes can make the same lines land very differently.`,
      uncertainty: 'That concern read comes from the private reflections, not from proof inside the shared evidence.',
      support: 'limited',
    })
  }

  if (gaps.length === 0) {
    gaps.push({
      id: 'gap-0',
      title: 'The record is too thin for a strong drift claim',
      evidenceCitations: units.slice(0, Math.min(2, units.length)).map((unit) => unit.citation),
      evidence: 'There is some shared evidence, but not enough observable signal to cleanly separate misunderstanding from disagreement.',
      interpretation:
        'A cautious read is more appropriate here than a firm theory about who inferred what.',
      uncertainty: 'Additional record or a clearer timeline would be needed for a stronger mediation read.',
      support: 'limited',
    })
  }

  return gaps.slice(0, 3)
}

function decidePublicContext(request: ContextualRunRequest): PublicContextDecision {
  const searchable = [request.personAReflection, request.personBReflection, request.sharedEvidence].join(' ').toLowerCase()
  const suggestedTopics = PUBLIC_CONTEXT_TOPICS.filter((topic) => topic.patterns.some((pattern) => pattern.test(searchable))).map(
    (topic) => topic.topic,
  )
  const relevant = suggestedTopics.length > 0

  if (!relevant) {
    return {
      requested: request.usePublicContext,
      relevant: false,
      decision: 'skip',
      rationale: request.usePublicContext
        ? 'Public context was requested, but the dispute does not appear to hinge on an external fact such as policy, price, availability, review, delay, or rule.'
        : 'The disagreement looks interpretive rather than externally verifiable, so public context is not needed.',
      suggestedTopics: [],
    }
  }

  return {
    requested: request.usePublicContext,
    relevant: true,
    decision: 'recommend',
    rationale: `This conflict may turn partly on an external fact about ${formatList(suggestedTopics)}. Public context could help verify that point, but it should stay separate from the private reflections.`,
    suggestedTopics,
  }
}

async function resolvePublicContext(
  request: ContextualRunRequest,
  publicContextDecision: PublicContextDecision,
): Promise<{
  publicContextDecision: PublicContextDecision
  publicContextArtifacts: PublicContextArtifact[]
  traceDetail: string
}> {
  if (!publicContextDecision.relevant) {
    return {
      publicContextDecision,
      publicContextArtifacts: [],
      traceDetail: publicContextDecision.rationale,
    }
  }

  if (!request.usePublicContext) {
    return {
      publicContextDecision,
      publicContextArtifacts: [],
      traceDetail: `${publicContextDecision.rationale} Public context was not requested for this run, so no external source was fetched.`,
    }
  }

  const result = await lookupPublicContext({
    request,
    relevantTopics: publicContextDecision.suggestedTopics,
  })

  if (result.artifacts.length === 0) {
    return {
      publicContextDecision,
      publicContextArtifacts: [],
      traceDetail: `${publicContextDecision.rationale} ${result.detail}`,
    }
  }

  return {
    publicContextDecision: {
      ...publicContextDecision,
      decision: 'used',
      rationale: `${publicContextDecision.rationale} ${result.detail}`,
    },
    publicContextArtifacts: result.artifacts,
    traceDetail: result.detail,
  }
}

function buildUncertainties(
  units: EvidenceUnit[],
  signals: SignalDetected[],
  reflectionA: ReflectionProfile,
  reflectionB: ReflectionProfile,
  publicContextDecision: PublicContextDecision,
  publicContextArtifacts: PublicContextArtifact[],
): UncertaintyNote[] {
  const uncertainties: UncertaintyNote[] = []

  if (units.length < 3) {
    uncertainties.push({
      issue: 'Sparse shared evidence',
      detail: 'The shared record is short, so the agent should avoid strong claims about drift or intent.',
      citations: units.map((unit) => unit.citation),
    })
  }

  const unknownSpeakerCount = units.filter((unit) => !unit.speaker).length
  if (unknownSpeakerCount > 0) {
    uncertainties.push({
      issue: 'Speaker attribution is partial',
      detail: 'Some evidence lines do not name a speaker, so turn-taking signals are more tentative.',
      citations: units.filter((unit) => !unit.speaker).map((unit) => unit.citation),
    })
  }

  if (signals.length === 0) {
    uncertainties.push({
      issue: 'Low observable signal',
      detail: 'The record does not show strong markers like escalation, mismatch, or explicit assumptions.',
      citations: units.slice(0, Math.min(2, units.length)).map((unit) => unit.citation),
    })
  }

  if (reflectionA.inferenceMarkers + reflectionB.inferenceMarkers > 3) {
    uncertainties.push({
      issue: 'Private reflections carry more interpretation than the record can prove',
      detail: 'The reflections appear to include inferred meaning or motive, which should not be treated as shared evidence.',
      citations: [],
    })
  }

  if (publicContextDecision.relevant && publicContextArtifacts.length === 0) {
    uncertainties.push({
      issue: 'An external fact may matter',
      detail: 'Part of the disagreement may depend on a public or verifiable fact that is not yet settled by the pasted record or fetched public context.',
      citations: [],
    })
  }

  if (reflectionA.uncertaintyMarkers + reflectionB.uncertaintyMarkers > 0) {
    uncertainties.push({
      issue: 'The private reflections contain their own uncertainty',
      detail: 'At least one reflection uses tentative language, which supports a cautious mediation read.',
      citations: [],
    })
  }

  return uncertainties.slice(0, 4)
}

function buildRepairRationale(gaps: InterpretationGap[], uncertainties: UncertaintyNote[]): string {
  const primaryGap = gaps[0]
  if (!primaryGap) {
    return 'The repair drafts stay close to the record, separate observation from interpretation, and avoid assigning motive.'
  }

  return uncertainties.length > 0
    ? `The repair drafts focus on ${primaryGap.title.toLowerCase()} while keeping the language cautious where the record is thin.`
    : `The repair drafts focus on ${primaryGap.title.toLowerCase()} and try to move the exchange back toward observable facts.`
}

function partyConcernPhrase(profile: ReflectionProfile): string {
  const primary = profile.topConcerns[0]
  switch (primary) {
    case 'clarity':
      return 'Can we pin down the exact moment each of us is relying on?'
    case 'respect':
      return 'I want to understand how this landed for you, not just defend my point.'
    case 'reliability':
      return 'I want to be concrete about what was expected and what actually happened.'
    case 'fairness':
      return 'I want to separate impact from blame so we can sort this out cleanly.'
    case 'autonomy':
      return 'I want to make room for your view instead of pushing mine through.'
    case 'belonging':
      return 'I want to check whether something in this exchange left you feeling outside the loop.'
    default:
      return 'Can we separate what was actually said from what each of us filled in?'
  }
}

function buildRepairStarter(party: Party, profile: ReflectionProfile, gaps: InterpretationGap[]): string {
  const primaryGap = gaps[0]?.title ?? ''

  if (primaryGap.includes('Different questions')) {
    return `I think I may have responded to a different part of this than the one that mattered most to you. ${partyConcernPhrase(profile)}`
  }

  if (primaryGap.includes('Ambiguous wording')) {
    return `I think I filled in meaning at a point that was not actually clear. ${partyConcernPhrase(profile)}`
  }

  if (primaryGap.includes('Clarification may have been replaced')) {
    return `I got more protective there than helpful. ${partyConcernPhrase(profile)}`
  }

  return `I may be reading more into this than the shared record can support. ${partyConcernPhrase(profile)}`
}

function buildSignalSummary(
  signals: SignalDetected[],
  reflectionA: ReflectionProfile,
  reflectionB: ReflectionProfile,
  units: EvidenceUnit[],
): string {
  const signalLabels = unique(signals.map((signal) => signalSummaryLabel(signal.type))).slice(0, 3)
  const concernLabels = unique([reflectionA.topConcerns[0], reflectionB.topConcerns[0]].filter(Boolean)).map((item) =>
    concernLabel(item as ConcernKey),
  )

  if (units.length < 3) {
    return 'The shared record is short, so this read is necessarily cautious. There is some room for interpretation drift, but not enough evidence for a strong claim.'
  }

  if (signalLabels.length === 0) {
    return 'The shared record does not show strong conflict markers on its own. The likely drift seems to sit more in interpretation than in clearly observable escalation.'
  }

  const concernText = concernLabels.length
    ? ` The private reflections suggest underlying concerns around ${formatList(concernLabels)}.`
    : ''

  return `The shared record shows ${formatList(signalLabels)} across ${units.length} parsed evidence lines.${concernText}`
}

function buildWhatBroke(signals: SignalDetected[], gaps: InterpretationGap[], units: EvidenceUnit[]): string {
  const primaryGap = gaps[0]
  const firstSignal = signals[0]

  if (units.length < 3) {
    return 'The record is too thin to isolate a single breakdown point. A cautious read is that the misunderstanding may have formed quickly, before either side checked the other meaning.'
  }

  if (!primaryGap) {
    return 'No single breakdown pattern stands out strongly. The safer read is a general drift between what was said and what was inferred.'
  }

  const signalText = firstSignal ? `Observable support appears around ${formatList(firstSignal.citations)}.` : ''
  return `${primaryGap.title}. ${signalText} The record supports a communication drift, not a definitive judgment about who was right.`.trim()
}

function buildInterpretationGapSummary(gaps: InterpretationGap[], uncertainties: UncertaintyNote[]): string {
  const primaryGap = gaps[0]
  if (!primaryGap) {
    return 'No strong interpretation gap could be stated from the available record.'
  }

  const caution = uncertainties.length > 0 ? ` ${primaryGap.uncertainty}` : ''
  return `${primaryGap.interpretation}${caution}`
}

function buildPublicContextCheck(publicContextDecision: PublicContextDecision): string {
  if (publicContextDecision.decision === 'used') {
    return `${publicContextDecision.rationale} Any fetched public context is treated as support for external facts only, not for private intent or hidden messages.`
  }

  if (publicContextDecision.decision === 'skip') {
    return publicContextDecision.rationale
  }

  return publicContextDecision.rationale
}

function buildTrace(
  reflectionA: ReflectionProfile,
  reflectionB: ReflectionProfile,
  units: EvidenceUnit[],
  signals: SignalDetected[],
  gaps: InterpretationGap[],
  publicContextDecision: PublicContextDecision,
  publicContextTraceDetail: string,
): TraceStep[] {
  const signalList = signals.length
    ? formatList(signals.slice(0, 3).map((signal) => signalSummaryLabel(signal.type)))
    : 'no strong signal markers'

  return [
    {
      id: '01',
      label: 'Parse reflections',
      status: 'done',
      tool: 'reflection-parser',
      detail: `Read both private reflections without quoting them back. Person A used ${reflectionA.wordCount} words; Person B used ${reflectionB.wordCount}.`,
    },
    {
      id: '02',
      label: 'Parse shared evidence',
      status: 'done',
      tool: 'evidence-parser',
      detail: `Parsed ${units.length} non-empty evidence lines into cited units ${units.map((unit) => unit.citation).join(', ')}.`,
    },
    {
      id: '03',
      label: 'Extract observable signals',
      status: 'done',
      tool: 'signal-detector',
      detail: `Detected ${signalList}.`,
    },
    {
      id: '04',
      label: 'Infer interpretation gaps',
      status: 'done',
      tool: 'gap-inference',
      detail: `Built ${gaps.length} interpretation-gap candidate${gaps.length === 1 ? '' : 's'} from the shared record and private context.`,
    },
    {
      id: '05',
      label: 'Check public-context relevance',
      status: publicContextDecision.decision === 'used' || publicContextDecision.decision === 'recommend' ? 'done' : 'skipped',
      tool: 'public-context-gate',
      detail: publicContextTraceDetail,
    },
    {
      id: '06',
      label: 'Draft mediation readout',
      status: 'done',
      tool: 'readout-builder',
      detail: 'Separated evidence, interpretation, and uncertainty into structured output fields.',
    },
    {
      id: '07',
      label: 'Generate repair starters',
      status: 'done',
      tool: 'repair-drafter',
      detail: 'Drafted one neutral repair starter for each party without exposing private reflection text.',
    },
    {
      id: '08',
      label: 'Assemble structured trace',
      status: 'done',
      tool: 'trace-assembler',
      detail: 'Packaged the mediation readout with citations and execution trace details.',
    },
  ]
}

export async function runContextualAgent(request: ContextualRunRequest): Promise<ContextualRunResponse> {
  const reflectionA = parseReflection(request.personAReflection, 'A')
  const reflectionB = parseReflection(request.personBReflection, 'B')
  const evidenceUnits = parseSharedEvidence(request.sharedEvidence)
  const signalsDetected = detectSignals(evidenceUnits)
  const evidenceHighlights = buildEvidenceHighlights(evidenceUnits, signalsDetected)
  const interpretationGaps = buildInterpretationGaps(signalsDetected, evidenceUnits, reflectionA, reflectionB)
  const initialPublicContextDecision = decidePublicContext(request)
  const { publicContextDecision, publicContextArtifacts, traceDetail: publicContextTraceDetail } =
    await resolvePublicContext(request, initialPublicContextDecision)
  const uncertainties = buildUncertainties(
    evidenceUnits,
    signalsDetected,
    reflectionA,
    reflectionB,
    publicContextDecision,
    publicContextArtifacts,
  )
  const repairRationale = buildRepairRationale(interpretationGaps, uncertainties)
  const repairStarterA = buildRepairStarter('A', reflectionA, interpretationGaps)
  const repairStarterB = buildRepairStarter('B', reflectionB, interpretationGaps)
  const trace = buildTrace(
    reflectionA,
    reflectionB,
    evidenceUnits,
    signalsDetected,
    interpretationGaps,
    publicContextDecision,
    publicContextTraceDetail,
  )

  return {
    consentStatus: 'Both private reflections and shared evidence received',
    signalSummary: buildSignalSummary(signalsDetected, reflectionA, reflectionB, evidenceUnits),
    whatBroke: buildWhatBroke(signalsDetected, interpretationGaps, evidenceUnits),
    interpretationGap: buildInterpretationGapSummary(interpretationGaps, uncertainties),
    publicContextCheck: buildPublicContextCheck(publicContextDecision),
    repairStarterA,
    repairStarterB,
    evidenceHighlights,
    signalsDetected,
    interpretationGaps,
    uncertainties,
    repairRationale,
    publicContextDecision,
    publicContextArtifacts,
    trace,
  }
}
