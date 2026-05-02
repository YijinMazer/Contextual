import { getSlackBot } from '@/lib/contextual/chat/slack-bot'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return getSlackBot().webhooks.slack(request)
}
