import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { computeDunningSuggestions } from '@/lib/finance/dunningSuggestions'

// GET /api/finance/dunning/suggestions
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const suggestions = await computeDunningSuggestions(userId, role)
  return NextResponse.json(suggestions)
}
