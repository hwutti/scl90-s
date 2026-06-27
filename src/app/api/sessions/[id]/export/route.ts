import { NextResponse } from 'next/server'
// Veraltet: ersetzt durch /api/assessments/[id]/export
export async function POST() {
  return NextResponse.json({ error: 'Verwende /api/assessments/[id]/export stattdessen' }, { status: 410 })
}
