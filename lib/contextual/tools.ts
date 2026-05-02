import { ContextualRunRequest, PublicContextArtifact } from './types'

interface PublicContextLookupInput {
  request: ContextualRunRequest
  relevantTopics: string[]
}

interface PublicContextLookupResult {
  artifacts: PublicContextArtifact[]
  detail: string
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]>"']+/gi) ?? []
  return unique(matches)
}

function buildQuery(request: ContextualRunRequest, relevantTopics: string[]): string {
  const combined = [request.personAReflection, request.personBReflection, request.sharedEvidence].join(' ')
  const tokens = combined
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .filter((token, index, all) => all.indexOf(token) === index)
    .slice(0, 10)

  return [...relevantTopics, ...tokens].slice(0, 12).join(' ')
}

function clip(text: string, max = 220): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTag(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern)
  return match?.[1]?.trim() || null
}

async function fetchUrlArtifact(url: string): Promise<PublicContextArtifact | null> {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ContextualAgent/0.1 public-context fetch',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const title =
      extractTag(html, /<title[^>]*>([^<]+)<\/title>/i) ||
      extractTag(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      parsed.hostname
    const description =
      extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      extractTag(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      clip(stripHtml(html), 220)

    return {
      sourceType: 'url',
      source: url,
      title: clip(title, 100),
      snippet: clip(description, 220),
      support: 'moderate',
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function lookupViaConfiguredMcp(input: PublicContextLookupInput): Promise<PublicContextLookupResult | null> {
  const endpoint = process.env.CONTEXTUAL_PUBLIC_CONTEXT_MCP_URL
  if (!endpoint) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'public_context_lookup',
        input: {
          query: buildQuery(input.request, input.relevantTopics),
          urls: extractUrls([input.request.personAReflection, input.request.personBReflection, input.request.sharedEvidence].join(' ')),
          topics: input.relevantTopics,
        },
      }),
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as {
      artifacts?: Array<{ source?: string; title?: string; snippet?: string }>
    }

    const artifacts = (payload.artifacts ?? [])
      .filter((artifact) => artifact.source && artifact.title && artifact.snippet)
      .slice(0, 3)
      .map((artifact) => ({
        sourceType: 'mcp' as const,
        source: artifact.source as string,
        title: clip(artifact.title as string, 100),
        snippet: clip(artifact.snippet as string, 220),
        support: 'moderate' as const,
      }))

    if (artifacts.length === 0) {
      return null
    }

    return {
      artifacts,
      detail: `Fetched ${artifacts.length} public context artifact${artifacts.length === 1 ? '' : 's'} through the configured MCP bridge.`,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function lookupPublicContext(input: PublicContextLookupInput): Promise<PublicContextLookupResult> {
  const mcpResult = await lookupViaConfiguredMcp(input)
  if (mcpResult) {
    return mcpResult
  }

  const urls = extractUrls([input.request.personAReflection, input.request.personBReflection, input.request.sharedEvidence].join(' ')).slice(0, 2)
  if (urls.length === 0) {
    return {
      artifacts: [],
      detail: 'No public URLs were present, so public context stayed at the recommendation layer only.',
    }
  }

  const artifacts = (await Promise.all(urls.map((url) => fetchUrlArtifact(url)))).filter(
    (artifact): artifact is PublicContextArtifact => Boolean(artifact),
  )

  if (artifacts.length === 0) {
    return {
      artifacts: [],
      detail: 'Public URLs were present, but no fetchable public context artifact could be recovered from them.',
    }
  }

  return {
    artifacts,
    detail: `Fetched ${artifacts.length} public page artifact${artifacts.length === 1 ? '' : 's'} from URL evidence.`,
  }
}
