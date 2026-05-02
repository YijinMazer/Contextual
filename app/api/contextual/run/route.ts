import { NextRequest, NextResponse } from 'next/server'
import { ContextualRunRequest, ContextualRunResponse } from '@/lib/contextual/types'
import { runContextualAgent } from '@/lib/contextual/run-agent'

/**
 * Validate request inputs.
 * Returns 400 if any required field is missing or empty after trimming.
 */
function validateRequest(body: unknown): { valid: true; data: ContextualRunRequest } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const { personAReflection, personBReflection, sharedEvidence, usePublicContext } = body as Record<string, unknown>

  // Type checks
  if (typeof personAReflection !== 'string') {
    return { valid: false, error: 'personAReflection must be a string' }
  }
  if (typeof personBReflection !== 'string') {
    return { valid: false, error: 'personBReflection must be a string' }
  }
  if (typeof sharedEvidence !== 'string') {
    return { valid: false, error: 'sharedEvidence must be a string' }
  }
  if (typeof usePublicContext !== 'boolean') {
    return { valid: false, error: 'usePublicContext must be a boolean' }
  }

  // Trimmed content checks
  const aReflectionTrimmed = personAReflection.trim()
  const bReflectionTrimmed = personBReflection.trim()
  const evidenceTrimmed = sharedEvidence.trim()

  if (!aReflectionTrimmed) {
    return { valid: false, error: 'Person A reflection cannot be empty' }
  }
  if (!bReflectionTrimmed) {
    return { valid: false, error: 'Person B reflection cannot be empty' }
  }
  if (!evidenceTrimmed) {
    return { valid: false, error: 'Shared evidence cannot be empty' }
  }

  return {
    valid: true,
    data: {
      personAReflection: aReflectionTrimmed,
      personBReflection: bReflectionTrimmed,
      sharedEvidence: evidenceTrimmed,
      usePublicContext,
    },
  }
}

/* ───────────────────────── API Handler ───────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validation = validateRequest(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Call agent with validated input
    const result: ContextualRunResponse = await runContextualAgent(validation.data)

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('[contextual/run] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

