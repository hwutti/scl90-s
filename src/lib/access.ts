import { prisma } from '@/lib/prisma'

// Standard Admin-Berechtigungen für Gruppenpraxis
export const DEFAULT_ADMIN_PERMISSIONS = {
  seeCalendar:        true,
  calendarAnonymized: true,   // Kalender anonym (kein Patientenname)
  seePatients:        false,
  seeProtocols:       false,
  seeDiagnoses:       false,
  seeFinance:         true,
}

export interface AdminPermissions {
  seeCalendar:        boolean
  calendarAnonymized: boolean
  seePatients:        boolean
  seeProtocols:       boolean
  seeDiagnoses:       boolean
  seeFinance:         boolean
}

// Praxis-Konfiguration laden (gecacht)
let _configCache: { mode: string; perms: AdminPermissions } | null = null
let _cacheTime = 0

export async function getPracticeConfig(): Promise<{ mode: string; perms: AdminPermissions }> {
  const now = Date.now()
  if (_configCache && now - _cacheTime < 30_000) return _configCache  // 30s Cache

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const mode = config?.practiceMode ?? 'single'
  let perms = { ...DEFAULT_ADMIN_PERMISSIONS }
  if (config?.adminPermissions) {
    try { perms = { ...perms, ...JSON.parse(config.adminPermissions) } } catch { /* ignore */ }
  }
  _configCache = { mode, perms }
  _cacheTime = now
  return _configCache
}

export function invalidatePracticeCache() {
  _configCache = null
  _cacheTime = 0
}

// Prüft ob userId auf patientId zugreifen darf
export async function canAccessPatient(
  userId: string,
  role: string,
  patientId: string
): Promise<boolean> {
  // Patient selbst
  if (role === 'PATIENT') {
    const p = await prisma.patient.findUnique({ where: { id: patientId } })
    return p?.patientUserId === userId
  }

  const { mode, perms } = await getPracticeConfig()

  // Admin
  if (role === 'ADMIN') {
    if (mode === 'single') return true
    return perms.seePatients
  }

  // Therapeut: eigener Patient?
  const ownRel = await prisma.therapistPatient.findUnique({
    where: { therapistId_patientId: { therapistId: userId, patientId } }
  })
  if (ownRel) return true

  // Therapeut: Freigabe?
  const share = await prisma.patientShare.findUnique({
    where: { patientId_sharedWithId: { patientId, sharedWithId: userId } }
  })
  return !!share
}

// Gibt alle Patienten-IDs zurück auf die userId Zugriff hat
export async function getAccessiblePatientIds(
  userId: string,
  role: string
): Promise<string[] | 'ALL'> {
  const { mode, perms } = await getPracticeConfig()

  if (role === 'ADMIN') {
    if (mode === 'single' || perms.seePatients) return 'ALL'
    return []
  }

  if (role === 'PATIENT') {
    const p = await prisma.patient.findFirst({ where: { patientUserId: userId } })
    return p ? [p.id] : []
  }

  // Therapeut: eigene + freigegebene
  const [ownRels, shares] = await Promise.all([
    prisma.therapistPatient.findMany({ where: { therapistId: userId }, select: { patientId: true } }),
    prisma.patientShare.findMany({ where: { sharedWithId: userId }, select: { patientId: true } }),
  ])
  const ids = new Set([
    ...ownRels.map(r => r.patientId),
    ...shares.map(s => s.patientId),
  ])
  return [...ids]
}
