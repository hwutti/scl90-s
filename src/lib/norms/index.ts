// ============================================================
// SCL-90-S Normen – Haupt-Export
// Unterstützt direkte Lookup-Tabellen (Summe → T)
// für alters- und geschlechtsspezifische Auswertung
// ============================================================
import {
  AgeGroup, AGE_GROUPS, getAgeGroup,
  lookupT, interpolateT,
  NORM_MAENNLICH, NORM_WEIBLICH,
  GSI_NORM_MAENNLICH_SAMPLES, GSI_NORM_WEIBLICH_SAMPLES,
  PST_NORM_MAENNLICH,
} from './lookup'

export { AgeGroup, AGE_GROUPS, getAgeGroup }

export type Gender = 'männlich' | 'weiblich'

export interface NormLookupResult {
  tScore: number | null
  ageGroup: AgeGroup | null
  method: 'lookup' | 'interpolation' | 'none'
}

// Skala-ID Mapping  (unsere IDs → Tabellenkeys)
const SCALE_KEY_MAP: Record<string, string> = {
  AGG: 'AGG', ANG: 'ANG', DEP: 'DEP', PAR: 'PAR',
  PHO: 'PHO', PSY: 'PSY', SOM: 'SOM', UNS: 'UNS', ZWA: 'ZWA',
}

// T-Score für Einzelskala per direkter Lookup-Tabelle
export function getScaleTScore(
  scaleId: string,
  summe: number,
  gender: Gender | string,
  age: number | null,
): NormLookupResult {
  const ageGroup = age !== null ? getAgeGroup(age) : null
  if (!ageGroup) return { tScore: null, ageGroup: null, method: 'none' }

  const key = SCALE_KEY_MAP[scaleId]
  if (!key) return { tScore: null, ageGroup, method: 'none' }

  const normSet = gender === 'weiblich' ? NORM_WEIBLICH : NORM_MAENNLICH
  const table = (normSet as any)[key]?.[ageGroup] as number[] | undefined
  if (!table) return { tScore: null, ageGroup, method: 'none' }

  const t = lookupT(table, summe)
  return { tScore: t, ageGroup, method: 'lookup' }
}

// T-Score für GSI (Summe = Rohsumme aller Items)
export function getGsiTScore(
  summe: number,
  gender: Gender | string,
  age: number | null,
): NormLookupResult {
  const ageGroup = age !== null ? getAgeGroup(age) : null
  if (!ageGroup) return { tScore: null, ageGroup: null, method: 'none' }

  const samples = gender === 'weiblich'
    ? GSI_NORM_WEIBLICH_SAMPLES[ageGroup]
    : GSI_NORM_MAENNLICH_SAMPLES[ageGroup]

  if (!samples) return { tScore: null, ageGroup, method: 'none' }

  const t = interpolateT(samples, summe)
  return { tScore: t, ageGroup, method: 'interpolation' }
}

// T-Score für PST (Anzahl Items > 0)
export function getPstTScore(
  pst: number,
  gender: Gender | string,
  age: number | null,
): NormLookupResult {
  const ageGroup = age !== null ? getAgeGroup(age) : null
  if (!ageGroup) return { tScore: null, ageGroup: null, method: 'none' }

  // PST-Normen aktuell nur für Männer vollständig digitalisiert
  // Frauen: Näherung via Männer-Tabelle (konservativ)
  const table = PST_NORM_MAENNLICH[ageGroup]
  if (!table) return { tScore: null, ageGroup, method: 'none' }

  const t = lookupT(table, pst)
  return { tScore: t, ageGroup, method: 'lookup' }
}

// Vollständige Normen für eine Person berechnen
export function computeNormedScores(
  scales: { id: string; sum: number; mean: number | null }[],
  gs: number,
  pst: number,
  gender: string | null,
  dob: string | null,
) {
  const age = dob ? calcAgeFromDob(dob) : null
  const genderNorm: Gender = gender === 'weiblich' ? 'weiblich' : 'männlich'

  const scaleTScores: Record<string, number | null> = {}
  for (const s of scales) {
    const result = getScaleTScore(s.id, s.sum, genderNorm, age)
    scaleTScores[s.id] = result.tScore
  }

  const gsiResult = getGsiTScore(gs, genderNorm, age)
  const pstResult = getPstTScore(pst, genderNorm, age)

  return {
    scaleTScores,
    gsiT: gsiResult.tScore,
    pstT: pstResult.tScore,
    psdiT: null, // PSDI-Normen (Intervall-Tabelle) → TODO
    ageGroup: gsiResult.ageGroup,
    gender: genderNorm,
  }
}

function calcAgeFromDob(dobStr: string): number | null {
  try {
    const dob = new Date(dobStr + 'T00:00:00')
    if (isNaN(dob.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    if (now.getMonth() - dob.getMonth() < 0 ||
       (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--
    return age
  } catch { return null }
}
