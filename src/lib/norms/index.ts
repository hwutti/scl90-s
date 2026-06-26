import {
  AgeGroup, AGE_GROUPS, getAgeGroup,
  lookupT, interpolateT,
  NORM_MAENNLICH, NORM_WEIBLICH,
  NORM_GESAMT_D, NORM_STUDIERENDE_D,
  GSI_NORM_MAENNLICH_SAMPLES, GSI_NORM_WEIBLICH_SAMPLES,
  GSI_NORM_GESAMT_D_SAMPLES,
  PST_NORM_MAENNLICH, PST_NORM_WEIBLICH, PST_NORM_GESAMT_D,
} from './lookup'

export type { AgeGroup }
export { AGE_GROUPS, getAgeGroup }

export type Gender = 'männlich' | 'weiblich'
export type NormSource = 'franke2014_alter_geschlecht' | 'franke2014_gesamt' | 'none'

const SCALE_KEY_MAP: Record<string, string> = {
  AGG:'AGG', ANG:'ANG', DEP:'DEP', PAR:'PAR',
  PHO:'PHO', PSY:'PSY', SOM:'SOM', UNS:'UNS', ZWA:'ZWA',
}

export interface NormLookupResult {
  tScore: number | null
  ageGroup: AgeGroup | null
  normSource: NormSource
}

// Skalen T-Score – alters+geschlechtsspezifisch (Anhang B/C)
export function getScaleTScore(
  scaleId: string, summe: number,
  gender: string, age: number | null,
): NormLookupResult {
  const ageGroup = age !== null ? getAgeGroup(age) : null
  const key = SCALE_KEY_MAP[scaleId]
  if (!key) return { tScore: null, ageGroup, normSource: 'none' }

  // Prio 1: alters+geschlechtsspezifisch
  if (ageGroup) {
    const normSet = gender === 'weiblich' ? NORM_WEIBLICH : NORM_MAENNLICH
    const table = (normSet as any)[key]?.[ageGroup] as number[]|undefined
    if (table) return { tScore: lookupT(table, summe), ageGroup, normSource: 'franke2014_alter_geschlecht' }
  }

  // Fallback: Gesamtstichprobe Anhang D
  const tableD = (NORM_GESAMT_D as any)[key] as number[]|undefined
  if (tableD) return { tScore: lookupT(tableD, summe), ageGroup: null, normSource: 'franke2014_gesamt' }

  return { tScore: null, ageGroup, normSource: 'none' }
}

// GSI T-Score
export function getGsiTScore(
  summe: number, gender: string, age: number | null,
): NormLookupResult {
  const ageGroup = age !== null ? getAgeGroup(age) : null

  if (ageGroup) {
    const samples = gender === 'weiblich'
      ? GSI_NORM_WEIBLICH_SAMPLES[ageGroup]
      : GSI_NORM_MAENNLICH_SAMPLES[ageGroup]
    if (samples) return { tScore: interpolateT(samples, summe), ageGroup, normSource: 'franke2014_alter_geschlecht' }
  }

  // Fallback Anhang D Gesamt
  return { tScore: interpolateT(GSI_NORM_GESAMT_D_SAMPLES, summe), ageGroup: null, normSource: 'franke2014_gesamt' }
}

// PST T-Score
export function getPstTScore(
  pst: number, gender: string, age: number | null,
): NormLookupResult {
  const ageGroup = age !== null ? getAgeGroup(age) : null

  if (ageGroup) {
    const table = gender === 'weiblich'
      ? PST_NORM_WEIBLICH[ageGroup]
      : PST_NORM_MAENNLICH[ageGroup]
    if (table) return { tScore: lookupT(table, pst), ageGroup, normSource: 'franke2014_alter_geschlecht' }
  }

  return { tScore: lookupT(PST_NORM_GESAMT_D, pst), ageGroup: null, normSource: 'franke2014_gesamt' }
}

// Vollständige Norm-Berechnung
export function computeNormedScores(
  scales: { id: string; sum: number; mean: number | null }[],
  gs: number, pst: number,
  gender: string | null, dob: string | null,
) {
  const age = dob ? calcAgeFromDob(dob) : null
  const genderNorm = gender === 'weiblich' ? 'weiblich' : 'männlich'

  const scaleTScores: Record<string, number | null> = {}
  let normSource: NormSource = 'none'

  for (const s of scales) {
    const r = getScaleTScore(s.id, s.sum, genderNorm, age)
    scaleTScores[s.id] = r.tScore
    if (r.normSource !== 'none') normSource = r.normSource
  }

  const gsiR = getGsiTScore(gs, genderNorm, age)
  const pstR = getPstTScore(pst, genderNorm, age)

  return {
    scaleTScores,
    gsiT: gsiR.tScore,
    pstT: pstR.tScore,
    psdiT: null,  // PSDI Intervall-Tabellen → separate Funktion
    ageGroup: gsiR.ageGroup,
    gender: genderNorm,
    normSource,
  }
}

// PSDI T-Score via Intervall-Lookup
// Tabellen: Anhang B (Männer S.122-124), Anhang C (Frauen S.146-149)
// Format: Intervall [von, bis] → T-Score je Altersgruppe
// Vereinfacht: untere Grenze des Intervalls als Lookup-Key (Schrittweite 0.025)
export function getPsdiTScore(
  psdi: number, gender: string, age: number | null,
): number | null {
  const ageGroup = age !== null ? getAgeGroup(age) : null
  if (!ageGroup) return null

  // PSDI-Lookup: key = Math.floor(psdi * 40) / 40 (0.025er Schritte)
  // Tabellen aus Anhang B (Männer) und Anhang C (Frauen)
  const idx = Math.min(Math.floor(psdi / 0.025), PSDI_SAMPLES_MAENNLICH[ageGroup]?.length - 1 ?? 0)

  const table = gender === 'weiblich'
    ? PSDI_SAMPLES_WEIBLICH[ageGroup]
    : PSDI_SAMPLES_MAENNLICH[ageGroup]

  if (!table || idx < 0) return null
  return table[Math.min(idx, table.length - 1)]
}

// PSDI Stützpunkte Männer (Anhang B, S.122-124) – repräsentative Werte
// [psdi_wert, T_16-24, T_25-34, T_35-44, T_45-54, T_55-64, T_65-74]
const PSDI_SAMPLES_MAENNLICH: Record<AgeGroup, number[]> = {
  "16-24": [31,31,34,35,36,38,39,40,41,42,43,45,47,47,48,48,49,50,50,51,52,53,53,54,54,55,57,57,58,58,59,59,60,60,61,62,63,63,64,65,66,66,67,67,68,69,70,74,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "25-34": [27,37,41,41,43,44,46,47,49,49,50,51,51,52,53,54,54,55,56,57,58,59,60,60,61,62,62,63,63,64,65,65,66,67,67,68,68,68,68,68,68,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,75,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "35-44": [28,40,45,45,47,49,50,52,53,54,55,54,55,55,56,57,57,58,59,60,60,61,62,63,63,63,64,65,66,66,67,67,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,69,69,70,70,70,71,71,74,74,74,76,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "45-54": [29,40,44,45,46,48,49,50,51,52,53,53,52,53,55,55,56,57,58,59,59,60,61,62,63,64,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,66,66,66,67,68,68,69,69,70,70,71,71,72,73,74,75,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "55-64": [27,40,45,46,47,48,49,51,52,53,54,55,55,55,56,56,57,57,57,57,58,58,59,59,59,59,60,61,61,62,63,63,63,63,63,64,64,64,64,64,64,65,65,65,65,66,66,67,68,69,70,71,72,72,72,72,72,73,74,74,75,76,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "65-74": [25,40,45,45,47,48,49,51,52,53,54,55,56,57,57,58,59,59,60,61,61,61,62,62,63,64,64,64,64,64,64,65,65,65,65,66,66,67,68,68,68,68,68,68,69,69,70,70,71,72,73,74,75,75,76,76,76,76,76,76,76,76,76,76,76,76,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
}

// PSDI Frauen (Anhang C, S.146-149)
const PSDI_SAMPLES_WEIBLICH: Record<AgeGroup, number[]> = {
  "16-24": [34,34,38,38,39,40,40,41,42,43,44,45,45,46,47,47,48,49,50,51,52,53,53,54,54,54,54,54,55,55,55,55,56,57,58,58,59,59,61,62,62,62,63,63,64,64,64,65,65,66,67,67,68,68,68,68,68,68,68,68,68,68,68,68,68,68,68,69,72,72,72,72,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "25-34": [24,38,42,43,44,45,46,47,48,50,52,52,53,54,55,56,57,57,57,57,57,57,57,57,57,57,57,57,57,58,58,59,60,61,61,61,62,62,62,62,63,63,64,65,65,66,67,67,67,67,67,67,68,69,69,69,69,69,69,69,70,71,71,71,71,71,71,73,73,73,73,73,73,73,73,74,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "35-44": [39,39,43,44,44,45,45,46,47,48,49,50,51,51,52,53,53,54,55,55,55,56,56,57,57,58,58,59,59,60,61,62,63,63,63,63,64,64,64,64,64,64,65,65,65,66,67,67,68,68,68,69,69,69,69,69,70,70,70,71,71,71,72,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,75,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "45-54": [25,39,44,44,45,46,47,48,49,50,51,52,53,53,54,54,55,56,57,58,58,59,60,61,61,62,62,63,63,64,65,65,65,66,66,67,67,68,68,68,69,69,69,70,71,72,73,73,73,73,74,76,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "55-64": [21,39,44,44,45,45,47,48,49,50,51,52,53,54,55,56,57,57,58,59,60,62,63,63,63,63,64,65,66,68,71,71,71,71,71,71,71,71,71,71,71,71,72,74,75,76,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
  "65-74": [37,37,42,42,42,44,45,47,48,50,51,52,52,54,55,56,57,57,58,59,60,61,62,63,64,65,65,65,65,66,67,68,70,70,70,71,71,71,72,73,73,74,75,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,76,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80],
}
