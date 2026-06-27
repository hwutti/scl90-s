import { NextResponse } from 'next/server'
// Veraltet: ersetzt durch /api/assessments/[id]/score
export async function POST() {
  return NextResponse.json({ error: 'Verwende /api/assessments/[id]/score stattdessen' }, { status: 410 })
}
