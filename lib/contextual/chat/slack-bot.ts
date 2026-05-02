import { Chat } from 'chat'
import { createSlackAdapter } from '@chat-adapter/slack'
import { createMemoryState } from '@chat-adapter/state-memory'
import { runContextualAgent } from '@/lib/contextual/run-agent'
import { ContextualRunResponse, TraceStep } from '@/lib/contextual/types'

type ReflectionSource = 'dm' | 'thread'

interface ThreadState {
  lastThreadPromptAt?: string
}

interface ReflectionRecord {
  userId: string
  fullName: string
  text: string
  source: ReflectionSource
  targetThreadId: string
  submittedAt: string
}

interface HumanParticipant {
  userId: string
  fullName: string
}

interface TranscriptSnapshot {
  sharedEvidence: string
  participants: HumanParticipant[]
  transcriptSource: string
  evidenceLineCount: number
}

const reflectionStore = new Map<string, ReflectionRecord>()

const reflectionPattern = /^(?:contextual\s+)?reflection(?:\s+for\s+([^\s]+))?\s*:\s*([\s\S]+)$/i

function reflectionKey(targetThreadId: string, userId: string) {
  return `${targetThreadId}:${userId}`
}

function parseStructuredReflection(text: string): { targetThreadId?: string; reflection: string } | null {
  const match = text.trim().match(reflectionPattern)
  if (!match) {
    return null
  }

  const targetThreadId = match[1]?.trim()
  const reflection = match[2]?.trim()

  if (!reflection) {
    return null
  }

  return {
    targetThreadId,
    reflection,
  }
}

function sanitizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function isReflectionInstruction(text: string): boolean {
  return reflectionPattern.test(text.trim())
}

function clip(text: string, max = 220): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

function shouldUsePublicContext(text: string): boolean {
  return /\b(public context|fact check|facts|policy|pricing|price|availability|review|delay|rules?)\b/i.test(text)
}

async function collectTranscript(thread: any): Promise<TranscriptSnapshot> {
  const messages: Array<{ text: string; author: { userId: string; fullName: string; isBot: boolean | 'unknown'; isMe: boolean } }> = []

  for await (const message of thread.allMessages) {
    messages.push({
      text: message.text,
      author: message.author,
    })
  }

  const recentHumanMessages = messages
    .filter((message) => !message.author.isMe && message.author.isBot !== true)
    .filter((message) => sanitizeLine(message.text).length > 0)
    .filter((message) => !isReflectionInstruction(message.text))
    .slice(-12)

  const participants: HumanParticipant[] = []
  const seen = new Set<string>()

  for (const message of recentHumanMessages) {
    if (seen.has(message.author.userId)) {
      continue
    }

    seen.add(message.author.userId)
    participants.push({
      userId: message.author.userId,
      fullName: message.author.fullName,
    })
  }

  const sharedEvidence = recentHumanMessages
    .map((message) => `${message.author.fullName}: ${sanitizeLine(message.text)}`)
    .join('\n')

  return {
    sharedEvidence,
    participants,
    transcriptSource:
      recentHumanMessages.length > 0
        ? `recent thread messages (${recentHumanMessages.length} lines)`
        : 'no usable thread messages',
    evidenceLineCount: recentHumanMessages.length,
  }
}

function getThreadReflections(targetThreadId: string, participants: HumanParticipant[]) {
  return participants.map((participant) => ({
    participant,
    reflection: reflectionStore.get(reflectionKey(targetThreadId, participant.userId)) ?? null,
  }))
}

function buildPrivacyPrompt(threadId: string): string {
  return [
    'I can use a private reflection if you choose to send one directly to me.',
    `DM me: \`reflection for ${threadId}: <your reflection>\``,
    'If you are fine sharing it in the thread, reply here with `reflection: <your reflection>` instead.',
    'I cannot see private DMs unless you send one to me on purpose.',
  ].join(' ')
}

async function promptForReflections(thread: any, participants: HumanParticipant[], missingParticipants: HumanParticipant[]) {
  const visibleNames = missingParticipants.map((participant) => participant.fullName).join(' and ')
  await thread.post(
    `I can draft a repair readout once I have brief reflections from both people. Still missing: ${visibleNames}. ${buildPrivacyPrompt(thread.id)}`,
  )

  for (const participant of participants) {
    try {
      await thread.postEphemeral(
        participant.userId,
        `${buildPrivacyPrompt(thread.id)} I will not quote a private reflection back into the thread as shared evidence.`,
      )
    } catch {
      // Ephemeral delivery is best effort.
    }
  }
}

function storeReflection(record: ReflectionRecord) {
  reflectionStore.set(reflectionKey(record.targetThreadId, record.userId), record)
}

function buildChatTrace(
  transcript: TranscriptSnapshot,
  response: ContextualRunResponse,
  reflectionMode: 'stored' | 'mocked',
): TraceStep[] {
  return [
    {
      id: 'C1',
      label: 'Chat surface',
      status: 'done',
      tool: 'chat-sdk/slack',
      detail: 'Handled from a Slack mention or subscribed thread reply.',
    },
    {
      id: 'C2',
      label: 'Transcript source',
      status: transcript.evidenceLineCount > 0 ? 'done' : 'skipped',
      tool: 'chat-sdk/thread-history',
      detail: transcript.transcriptSource,
    },
    {
      id: 'C3',
      label: 'Public context',
      status: response.publicContextDecision.decision === 'skip' ? 'skipped' : 'done',
      tool: 'contextual/public-context',
      detail: response.publicContextDecision.rationale,
    },
    {
      id: 'C4',
      label: 'Run memory',
      status: 'done',
      tool: 'contextual/reflection-store',
      detail:
        reflectionMode === 'stored'
          ? 'Stored reflections in an in-memory process store for this bot instance.'
          : 'No persisted reflection memory was available; relying on current thread inputs only.',
    },
  ]
}

function formatRepairReadout(
  participants: HumanParticipant[],
  response: ContextualRunResponse,
  transcript: TranscriptSnapshot,
  reflectionMode: 'stored' | 'mocked',
): string {
  const personA = participants[0]?.fullName ?? 'Person A'
  const personB = participants[1]?.fullName ?? 'Person B'
  const topEvidence = response.evidenceHighlights[0]
  const topUncertainty = response.uncertainties[0]
  const chatTrace = buildChatTrace(transcript, response, reflectionMode)

  return [
    'Contextual readout:',
    `- Evidence: ${topEvidence ? `${topEvidence.citation} shows ${topEvidence.observation.toLowerCase()}` : 'The thread does not yet contain enough shared evidence for a stronger citation.'}`,
    `- Interpretation gap: ${response.interpretationGap}`,
    `- Uncertainty: ${topUncertainty ? topUncertainty.detail : 'This read stays cautious and does not treat inference as proof.'}`,
    `- Repair for ${personA}: ${response.repairStarterA}`,
    `- Repair for ${personB}: ${response.repairStarterB}`,
    '- Privacy: Private reflections informed this readout if participants chose to send them, but they are not quoted here as shared evidence.',
    `- Trace: ${chatTrace.map((step) => `${step.label.toLowerCase()}=${step.detail}`).join(' | ')}`,
  ].join('\n')
}

async function tryRunContextual(thread: any, triggerText: string) {
  const transcript = await collectTranscript(thread)

  if (transcript.participants.length < 2) {
    await thread.post(
      'I need a thread with two human participants and some shared conversation history before I can draft a repair readout.',
    )
    return
  }

  if (transcript.participants.length > 2) {
    await thread.post(
      'This Slack entry point currently supports two primary participants. Please narrow the thread to the two people whose miscommunication you want reviewed.',
    )
    return
  }

  if (!transcript.sharedEvidence.trim()) {
    await thread.post(
      'I do not have enough shared thread messages yet. Once there is a real exchange in the thread, mention me again and I can compare it with each person\'s reflection.',
    )
    return
  }

  const reflections = getThreadReflections(thread.id, transcript.participants)
  const missingParticipants = reflections.filter((entry) => !entry.reflection).map((entry) => entry.participant)

  if (missingParticipants.length > 0) {
    await promptForReflections(thread, transcript.participants, missingParticipants)
    return
  }

  const response = await runContextualAgent({
    personAReflection: reflections[0].reflection!.text,
    personBReflection: reflections[1].reflection!.text,
    sharedEvidence: transcript.sharedEvidence,
    usePublicContext: shouldUsePublicContext(triggerText),
  })

  await thread.post(formatRepairReadout(transcript.participants, response, transcript, 'stored'))
}

async function handleReflectionMessage(thread: any, message: any) {
  const parsed = parseStructuredReflection(message.text)
  if (!parsed) {
    return false
  }

  const targetThreadId = parsed.targetThreadId ?? thread.id
  const source: ReflectionSource = thread.isDM ? 'dm' : 'thread'

  if (thread.isDM && !parsed.targetThreadId) {
    await thread.post(
      'Please include the target thread ID in a DM reflection so I know where to apply it. Example: `reflection for slack:C123:1234567890.123456: I felt dismissed when the question got skipped.`',
    )
    return true
  }

  storeReflection({
    userId: message.author.userId,
    fullName: message.author.fullName,
    text: parsed.reflection,
    source,
    targetThreadId,
    submittedAt: new Date().toISOString(),
  })

  if (thread.isDM) {
    await thread.post(
      `Stored your private reflection for \`${targetThreadId}\`. I will only use it because you sent it directly to me, and I will not quote it back into the channel as shared evidence.`,
    )
    return true
  }

  await thread.post(
    `${message.author.fullName}, I stored that reflection for this thread. I will use it as context, not quote it back as shared evidence.`,
  )
  await tryRunContextual(thread, message.text)
  return true
}

let slackBotSingleton: Chat<{ slack: ReturnType<typeof createSlackAdapter> }, ThreadState> | null = null

export function getSlackBot() {
  if (slackBotSingleton) {
    return slackBotSingleton
  }

  const slackBot = new Chat<{ slack: ReturnType<typeof createSlackAdapter> }, ThreadState>({
    userName: process.env.SLACK_BOT_USERNAME || 'contextual',
    adapters: {
      slack: createSlackAdapter(),
    },
    state: createMemoryState(),
  })

  slackBot.onNewMention(async (thread, message) => {
    await thread.subscribe()
    await tryRunContextual(thread, message.text)
  })

  slackBot.onSubscribedMessage(async (thread, message) => {
    const handledReflection = await handleReflectionMessage(thread, message)
    if (handledReflection) {
      return
    }

    if (thread.isDM) {
      await thread.post(
        'For a private reflection, send `reflection for <thread-id>: <your reflection>`. I only use DMs you explicitly send to me, and I do not infer access to other private messages.',
      )
      return
    }

    if (message.isMention) {
      await tryRunContextual(thread, message.text)
    }
  })

  slackBot.onNewMessage(/^(?:contextual\s+)?reflection\b/i, async (thread, message) => {
    const handledReflection = await handleReflectionMessage(thread, message)
    if (handledReflection) {
      return
    }

    if (thread.isDM) {
      await thread.post(
        'If you want me to use a private reflection, send it as `reflection for <thread-id>: <your reflection>`. Otherwise, mention me in the shared Slack thread first.',
      )
    }
  })

  slackBotSingleton = slackBot
  return slackBotSingleton
}
