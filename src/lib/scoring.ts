// ============================================================
// SCL-90-S Scoring – mit alters-/geschlechtsspez. T-Normen
// Franke (2014), Anhang B (Männer) + Anhang C (Frauen)
// ============================================================
import { SCALES, RISK_THRESHOLDS, T_BANDS } from './constants'
import { computeNormedScores } from './norms/index'

export interface ScaleResult {
  id: string
  name: string
  shortName: string
  items: number[]
  isAddOn: boolean
  sum: number
  mean: number | null
  pCount: number
  missing: number
  answered: number
  tScore: number | null
  risk: 'green' | 'yellow' | 'red' | null
  flaggedItems: number[]
}

export interface GlobalResult {
  gs: number
  gsi: number | null
  pst: number
  psdi: number | null
  missingTotal: number
  answeredTotal: number
  gsiT: number | null
  pstT: number | null
  psdiT: number | null
  isClinicalCase: boolean
  clinicalReason: string
  ageGroup: string | null
  genderUsed: string | null
}

export interface ScoringResult {
  scales: ScaleResult[]
  global: GlobalResult
}

export type AnswerMap = Map<number, number | null>

// Legacy: Normblock aus DB (Mean/SD-Format) – optional
export interface NormBlock {
  scales: Record<string, { mean: number; sd: number }>
  gsi:  { mean: number; sd: number }
  pst:  { mean: number; sd: number }
  psdi: { mean: number; sd: number }
}

export function computeScore(
  answers: AnswerMap,
  normBlock?: NormBlock | null,
  gender?: string | null,
  dob?: string | null,
): ScoringResult {

  const scales: ScaleResult[] = SCALES.map(s => {
    let sum = 0, pCount = 0, answered = 0
    const flaggedItems: number[] = []

    for (const itemNo of s.items) {
      const val = answers.get(itemNo)
      if (val === null || val === undefined) continue
      answered++
      sum += val
      if (val > 0) pCount++
      if (val >= 2) flaggedItems.push(itemNo)
    }

    const missing = s.items.length - answered
    const mean = answered > 0 ? sum / answered : null

    return {
      id: s.id, name: s.name, shortName: s.shortName,
      items: s.items, isAddOn: !!s.isAddOn,
      sum, mean, pCount, missing, answered,
      tScore: null,  // wird unten befüllt
      risk: s.isAddOn ? null : riskForG(mean),
      flaggedItems,
    }
  })

  const missingTotal = Array.from(answers.values()).filter(v => v === null || v === undefined).length
  const answeredTotal = 90 - missingTotal
  const gs = scales.reduce((acc, s) => acc + s.sum, 0)
  const pst = scales.reduce((acc, s) => acc + s.pCount, 0)
  const gsi = answeredTotal > 0 ? gs / answeredTotal : null
  const psdi = pst > 0 ? gs / pst : null

  // T-Score Berechnung
  let gsiT: number | null = null
  let pstT: number | null = null
  let psdiT: number | null = null
  let ageGroup: string | null = null
  let genderUsed: string | null = null

  // Priorität 1: Lookup-Tabellen (Franke 2014, Anhang B/C)
  if (gender && dob) {
    const mainScales = scales.filter(s => !s.isAddOn)
    const normed = computeNormedScores(
      mainScales.map(s => ({ id: s.id, sum: s.sum, mean: s.mean })),
      gs, pst, gender, dob,
    )

    for (const s of scales) {
      if (!s.isAddOn) s.tScore = normed.scaleTScores[s.id] ?? null
    }
    gsiT = normed.gsiT
    pstT = normed.pstT
    ageGroup = normed.ageGroup
    genderUsed = normed.gender
  }
  // Priorität 2: Mean/SD aus DB (Legacy-Normtabellen)
  else if (normBlock) {
    for (const s of scales) {
      if (!s.isAddOn && s.mean !== null && normBlock.scales[s.id]) {
        s.tScore = calcTScore(s.mean, normBlock.scales[s.id])
      }
    }
    if (gsi !== null && normBlock.gsi) gsiT = calcTScore(gsi, normBlock.gsi)
    if (normBlock.pst) pstT = calcTScore(pst, normBlock.pst)
    if (psdi !== null && normBlock.psdi) psdiT = calcTScore(psdi, normBlock.psdi)
  }

  // Falldefinition (Schritt 1)
  let isClinicalCase = false
  let clinicalReason = '—'
  if (gsiT !== null && gsiT >= 63) {
    isClinicalCase = true
    clinicalReason = `GSI T = ${Math.round(gsiT)} ≥ 63`
  } else {
    const elevated = scales.filter(s => !s.isAddOn && s.tScore !== null && s.tScore >= 63)
    if (elevated.length >= 2) {
      isClinicalCase = true
      clinicalReason = `${elevated.length} Skalen mit T ≥ 63 (${elevated.map(s => s.id).join(', ')})`
    }
  }

  return {
    scales,
    global: {
      gs, gsi, pst, psdi, missingTotal, answeredTotal,
      gsiT, pstT, psdiT,
      isClinicalCase, clinicalReason,
      ageGroup, genderUsed,
    },
  }
}

export function calcTScore(raw: number, norm: { mean: number; sd: number }): number | null {
  if (!norm || norm.sd === 0) return null
  return 50 + 10 * ((raw - norm.mean) / norm.sd)
}

export function riskForG(g: number | null): 'green' | 'yellow' | 'red' | null {
  if (g === null) return null
  if (g < RISK_THRESHOLDS.green)  return 'green'
  if (g < RISK_THRESHOLDS.yellow) return 'yellow'
  return 'red'
}

export function tBandLabel(t: number | null): string {
  if (t === null) return '—'
  for (const b of T_BANDS) { if (t < b.max) return b.label }
  return '—'
}

export function answersArrayToMap(answers: { itemNumber: number; value: number | null }[]): AnswerMap {
  const map = new Map<number, number | null>()
  for (let i = 1; i <= 90; i++) map.set(i, null)
  for (const a of answers) map.set(a.itemNumber, a.value)
  return map
}

export function formatG(val: number | null): string {
  return val === null ? '—' : val.toFixed(2)
}

export function formatT(val: number | null): string {
  return val === null ? '—' : Math.round(val).toString()
}
