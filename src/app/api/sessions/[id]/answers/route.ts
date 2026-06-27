import { NextResponse } from 'next/server'
// Veraltet: ersetzt durch /api/assessments/[id]/answers
export async function PATCH() {
  return NextResponse.json({ error: 'Verwende /api/assessments/[id]/answers stattdessen' }, { status: 410 })
}
