import { NextResponse } from 'next/server'
// Veraltet: ersetzt durch /api/patients/[id]/assessments und /api/assessments
export async function GET() {
  return NextResponse.json({ error: 'Verwende /api/patients stattdessen' }, { status: 410 })
}
export async function POST() {
  return NextResponse.json({ error: 'Verwende /api/patients/[id]/assessments stattdessen' }, { status: 410 })
}
