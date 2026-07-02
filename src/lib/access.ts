import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

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

// ─── Session-Guards für API-Routen ─────────────────────────────────────────────
// Geben entweder { session, userId, role } zurück oder { error: NextResponse },
// damit Routen einheitlich schreiben können:
//   const auth = await requireStaffSession()
//   if ('error' in auth) return auth.error

type SessionGuardResult =
  | { session: any; userId: string; role: string }
  | { error: NextResponse }

// Nur eingeloggte Staff-Rollen (ADMIN/THERAPIST) -- blockt insbesondere
// Patienten-Logins (Rolle PATIENT) von internen/administrativen Routen ab.
export async function requireStaffSession(): Promise<SessionGuardResult> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const role = (session.user as any).role
  if (!['ADMIN', 'THERAPIST'].includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, userId: (session.user as any).id, role }
}

// Nur ADMIN -- für global wirksame Praxisdaten/Branding.
export async function requireAdminSession(): Promise<SessionGuardResult> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const role = (session.user as any).role
  if (role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, userId: (session.user as any).id, role }
}

// Prisma-where-Klausel für Transaktionen, konsistent mit canAccessPatient/
// getAccessiblePatientIds: statt nur "von mir selbst erstellt" (createdByUserId)
// werden auch Transaktionen zu freigegebenen Patient:innen berücksichtigt.
// Kooperationspartner-Transaktionen sind wie die Partner-Stammdaten selbst für
// alle Staff-Rollen sichtbar (kein Freigabe-Konzept für Partner, siehe
// canAccessCooperationPartner) -- das ist eine bewusste Produktentscheidung,
// keine technische Notwendigkeit.
export async function buildAccessibleTransactionWhere(userId: string, role: string): Promise<any> {
  if (role === 'ADMIN') {
    const { mode, perms } = await getPracticeConfig()
    if (mode === 'single' || perms.seeFinance) return {}
    return { createdByUserId: userId }
  }

  const patientIds = await getAccessiblePatientIds(userId, role)
  const patientClause = patientIds === 'ALL' ? {} : { patientId: { in: patientIds } }

  return {
    OR: [
      patientClause,
      { cooperationPartnerId: { not: null } },
      { createdByUserId: userId },
    ],
  }
}

// Kooperationspartner sind globale Stammdaten ohne individuelles Freigabe-
// Konzept (anders als Patient:innen) -- jede Staff-Rolle mit Zugriff auf den
// Bereich "Kooperationspartner" darf sie sehen/verwenden. Admin-only bleibt
// weiterhin das Bearbeiten/Löschen der Partner-Stammdaten selbst.
export async function canAccessCooperationPartner(
  userId: string,
  role: string,
  partnerId: string
): Promise<boolean> {
  if (!['ADMIN', 'THERAPIST'].includes(role)) return false
  const partner = await prisma.cooperationPartner.findUnique({ where: { id: partnerId } })
  return !!partner && partner.isActive
}
