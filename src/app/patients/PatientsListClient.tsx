'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, UserPlus, AlertCircle, CheckCircle,
  Clock, ChevronRight, Activity, Users, X, Copy, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PatientRow {
  id: string
  firstName: string
  lastName: string
  dob: string
  gender: string
  active: boolean
  categoryType?: string | null  // PAIR | FAMILY | GROUP | null
  patientUser: { pin: string } | null
  assessments: Array<{
    status: string
    createdAt: string
    result: { isClinicalCase: boolean; scores: any } | null
  }>
}

interface Instrument { id: string; code: string; shortName: string; name: string }
interface Props {
  patients: PatientRow[]
  instruments: Instrument[]
  role: string
  /** Wenn gesetzt: diese Ansicht zeigt/erstellt NUR Patienten dieses Kooperationspartners
   *  (siehe /kooperationspartner/[id]) statt der normalen, davon komplett entkoppelten
   *  Patientenliste unter /patients. */
  cooperationPartnerId?: string
  cooperationPartnerName?: string
}

const GENDER_LABEL:  Record<string, string> = { MALE: 'männlich', FEMALE: 'weiblich', DIVERSE: 'divers' }
const GENDER_SYMBOL: Record<string, string> = { MALE: '♂', FEMALE: '♀', DIVERSE: '⚧' }


// Standard-Seeds, falls /api/settings/avatars noch nicht geladen ist (identisch
// mit DEFAULT_AVATAR_SETTINGS in src/lib/avatarSettings.ts)
const DEFAULT_AVATAR_SEEDS: Record<string, string> = {
  MALE: 'kds-male-default', FEMALE: 'kds-female-default', DIVERSE: 'kds-diverse-default',
  PAIR: 'kds-pair-default-a,kds-pair-default-b',
  FAMILY: 'kds-family-default-a,kds-family-default-b,kds-family-default-c',
  GROUP: 'kds-group-default-a,kds-group-default-b,kds-group-default-c,kds-group-default-d',
}
function avatarGroupFor(gender: string, categoryType?: string | null, isKind?: boolean): string {
  if (categoryType === 'PAIR' || categoryType === 'FAMILY' || categoryType === 'GROUP') return categoryType
  if (isKind) return 'CHILD'
  return gender === 'MALE' || gender === 'FEMALE' ? gender : 'DIVERSE'
}
// Bei Paar/Familie/Gruppe ist der gespeicherte Wert eine kommagetrennte Liste
// mehrerer Personen-Seeds (siehe src/lib/avatarSettings.ts) → ?seeds= statt ?seed=
function avatarImgSrc(seedOrSeeds: string, bg?: string): string {
  const bgParam = bg ? `&bg=${bg}` : ''
  if (seedOrSeeds.includes(',')) {
    return `/api/avatar?seeds=${encodeURIComponent(seedOrSeeds)}${bgParam}`
  }
  return `/api/avatar?seed=${encodeURIComponent(seedOrSeeds)}${bgParam}`
}
// Ordner unter /public/avatars/illustrated je Gruppe (muss zu AVATAR_GROUP_POOL
// in src/lib/avatarSettings.ts passen)
const ILLUSTRATED_POOL: Record<string, 'individuals' | 'kids' | 'groups'> = {
  MALE: 'individuals', FEMALE: 'individuals', DIVERSE: 'individuals',
  CHILD: 'kids', PAIR: 'groups', FAMILY: 'groups', GROUP: 'groups',
}

// ── PatientIcon: globaler Avatar (unter Einstellungen → Avatare festgelegt) + Pill ──
function PatientIcon({
  gender, dob, categoryType, size = 52, avatarSeeds = DEFAULT_AVATAR_SEEDS,
  avatarStyle = 'dicebear', avatarIllustrated = {},
}: {
  gender: string
  dob: string
  categoryType?: string | null
  size?: number
  avatarSeeds?: Record<string, string>
  avatarStyle?: string
  avatarIllustrated?: Record<string, string>
}) {
  const age    = calcAge(dob)
  const isKind = age !== null && age < 18
  const color  = categoryType === 'PAIR'   ? '#10b981'
               : categoryType === 'FAMILY' ? '#f97316'
               : categoryType === 'GROUP'  ? '#6366f1'
               : isKind ? '#f59e0b'
               : gender === 'MALE'   ? '#3b82f6'
               : gender === 'FEMALE' ? '#ec4899'
               : '#8b5cf6'

  const pillLabel = categoryType === 'PAIR'   ? 'Paar'
                  : categoryType === 'FAMILY' ? 'Familie'
                  : categoryType === 'GROUP'  ? 'Gruppe'
                  : isKind
                    ? (GENDER_SYMBOL[gender] ?? '?') + ' <18'
                    : (GENDER_LABEL[gender] ?? gender)

  const group = avatarGroupFor(gender, categoryType, isKind)
  const src = avatarStyle === 'illustrated'
    ? `/avatars/illustrated/${ILLUSTRATED_POOL[group] ?? 'individuals'}/${avatarIllustrated[group] ?? 'ind01.png'}`
    : avatarImgSrc(avatarSeeds[group] ?? DEFAULT_AVATAR_SEEDS[group], 'e3e3e3')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${color}` }}>
        <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, minWidth: size, maxWidth: size, display: 'block', objectFit: 'cover' }} />
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
        background: color, color: 'white', whiteSpace: 'nowrap', lineHeight: 1.6,
      }}>
        {pillLabel}
      </span>
    </div>
  )
}

function calcAge(dob: string): number | null {
  const d = new Date(dob + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  let age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--
  return age
}

function formatDate(s: string) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'short' }).format(new Date(s))
}

function Avatar({ firstName, lastName, clinical }: { firstName: string; lastName: string; clinical: boolean | null }) {
  const initials = `${firstName[0]}${lastName[0]}`
  return (
    <div className={cn(
      'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors',
      clinical === true  ? 'bg-red-100 text-red-700'
      : clinical === false ? 'bg-emerald-100 text-emerald-700'
      : 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
    )}>
      {initials}
    </div>
  )
}

function StatusDot({ clinical }: { clinical: boolean | null }) {
  if (clinical === null) return <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />
  if (clinical) return <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
  return <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
}

export function PatientsListClient({ patients, instruments, role, cooperationPartnerId, cooperationPartnerName }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [avatarSeeds, setAvatarSeeds] = useState<Record<string, string>>(DEFAULT_AVATAR_SEEDS)
  const [avatarStyle, setAvatarStyle] = useState<string>('dicebear')
  const [avatarIllustrated, setAvatarIllustrated] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/settings/avatars').then(r => r.json()).then(d => {
      if (d?.seeds) setAvatarSeeds(d.seeds)
      if (d?.style) setAvatarStyle(d.style)
      if (d?.illustrated) setAvatarIllustrated(d.illustrated)
    }).catch(() => {})
  }, [])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newPin, setNewPin] = useState<string | null>(null)
  const [newPatientId, setNewPatientId] = useState<string | null>(null)
  const [pinCopied, setPinCopied] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', gender: 'MALE',
    phone: '', email: '', insuranceProvider: '', referralSource: '',
    createLogin: true,
    // Abrechnungs-Einstellungen (KDS-SCR-18)
    defaultBillingMode: 'time',
    defaultUnitDuration: 50,
    defaultUnitPriceNet: '',
    sessionStartNumber: 0,
  })

  const filtered = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  // Statistiken
  const total    = patients.length
  const clinical = patients.filter(p => p.assessments[0]?.result?.isClinicalCase === true).length
  const pending  = patients.filter(p => ['ASSIGNED','IN_PROGRESS'].includes(p.assessments[0]?.status ?? '')).length
  const noTest   = patients.filter(p => p.assessments.length === 0).length

  async function createPatient() {
    setLoading(true)
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cooperationPartnerId ? { ...form, cooperationPartnerId } : form),
    })
    const data = await res.json()
    setLoading(false)
    if (data.id) {
      setNewPatientId(data.id)
      if (data.generatedPin) setNewPin(data.generatedPin)
      else { setCreating(false); router.refresh() }
    }
  }

  function copyPin() {
    if (!newPin) return
    navigator.clipboard.writeText(newPin)
    setPinCopied(true)
    setTimeout(() => setPinCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {cooperationPartnerId ? `Patienten · ${cooperationPartnerName ?? 'Kooperationspartner'}` : 'Patienten'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {total} {total === 1 ? 'Patient' : 'Patienten'}
            {cooperationPartnerId
              ? ' · Abrechnung läuft gesammelt über den Kooperationspartner, nicht direkt hier.'
              : ' in Ihrer Praxis'}
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <UserPlus style={{ width: 14, height: 14 }} /> Neuer Patient
        </button>
      </div>
      <div style={{ padding: 20, flex: 1 }}>

      {/* ── KPI-Zeile ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gesamt',          value: total,    icon: Users,         color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-light)]' },
          { label: 'Klinisch auffällig', value: clinical, icon: AlertCircle, color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Test ausstehend', value: pending,  icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Noch kein Test',  value: noTest,   icon: Activity,      color: 'text-[var(--text-muted)]',  bg: 'bg-[var(--surface-panel)]' },
        ].map(k => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', k.bg)}>
              <k.icon className={cn('w-4 h-4', k.color)} />
            </div>
            <div>
              <p className={cn('text-xl font-bold', k.color)}>{k.value}</p>
              <p className="text-xs text-[var(--text-muted)] leading-tight">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Suche ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <input
          className="input pl-10"
          placeholder="Patient nach Name suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Patientenliste ── */}
      {filtered.length === 0 ? (
        <div className="card py-20 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-400">
            {search ? `Kein Patient gefunden für „${search}"` : 'Noch keine Patienten vorhanden.'}
          </p>
          {!search && (
            <button onClick={() => setCreating(true)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Ersten Patienten anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Tabellen-Header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[var(--border)] bg-slate-50">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Patient</span>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Letzter Test</span>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">GSI</span>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</span>
            <span />
          </div>

          <div className="divide-y divide-slate-50">
            {filtered.map(p => {
              const last    = p.assessments[0]
              const scores  = last?.result?.scores as any
              const gsiT    = scores?.gsiT ? Math.round(scores.gsiT) : null
              const gsi     = scores?.gsi  ? (scores.gsi as number).toFixed(2) : null
              const clinical = last?.result?.isClinicalCase ?? null
              const age     = calcAge(p.dob)

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 items-center
                             px-5 py-4 hover:bg-[var(--surface-panel)]/80 cursor-pointer transition-colors group"
                  onClick={() => router.push(`/patients/${p.id}`)}
                >
                  {/* Patient */}
                  <div className="flex items-center gap-3">
                    <PatientIcon gender={p.gender} dob={p.dob} categoryType={(p as any).categoryType} size={44} avatarSeeds={avatarSeeds} avatarStyle={avatarStyle} avatarIllustrated={avatarIllustrated} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {p.lastName}, {p.firstName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {age !== null ? `${age} J.` : '—'}
                        {(p as any).codeName && (
                          <span className="ml-2 font-mono opacity-60">{(p as any).codeName}</span>
                        )}
                        {p.patientUser && (
                          <span className="ml-2 text-[var(--color-primary)] font-mono">PIN {p.patientUser.pin}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Letzter Test */}
                  <div className="sm:block">
                    {last ? (
                      <p className="text-sm text-slate-500">{formatDate(last.createdAt)}</p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] italic">kein Test</p>
                    )}
                  </div>

                  {/* GSI */}
                  <div>
                    {gsiT !== null ? (
                      <div className="flex items-center gap-1.5">
                        <StatusDot clinical={clinical} />
                        <span className={cn(
                          'text-sm font-semibold tabular-nums',
                          clinical ? 'text-red-600' : 'text-emerald-600'
                        )}>
                          T={gsiT}
                        </span>
                        {gsi && <span className="text-xs text-slate-400">({gsi})</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Status-Badge */}
                  <div>
                    {clinical === true  && <span className="badge-red text-xs">⚠ auffällig</span>}
                    {clinical === false && <span className="badge-green text-xs">✓ unauffällig</span>}
                    {clinical === null && last && (
                      <span className="badge-gray text-xs">
                        {last.status === 'ASSIGNED' ? 'zugewiesen'
                        : last.status === 'IN_PROGRESS' ? 'läuft…'
                        : last.status}
                      </span>
                    )}
                    {!last && <span className="badge-gray text-xs">neu</span>}
                  </div>

                  {/* Pfeil */}
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-muted)] transition-colors hidden sm:block" />
                </div>
              )
            })}
          </div>

          {filtered.length < patients.length && (
            <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-panel)] text-xs text-slate-400">
              {filtered.length} von {patients.length} Patienten angezeigt
            </div>
          )}
        </div>
      )}

      </div>
      {/* ── Modal: Neuer Patient ── */}
      {creating && !newPin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Neuen Patienten anlegen</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Pflichtfelder sind mit * markiert</p>
              </div>
              <button onClick={() => setCreating(false)} className="btn-secondary p-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vorname *</label>
                  <input className="input" placeholder="Maria"
                    value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Nachname *</label>
                  <input className="input" placeholder="Muster"
                    value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} />
                </div>
              </div>

              {/* Geburtsdatum + Geschlecht */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Geburtsdatum *</label>
                  <input type="date" className="input" value={form.dob}
                    onChange={e => setForm(f => ({...f, dob: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Geschlecht *</label>
                  <select className="input" value={form.gender}
                    onChange={e => setForm(f => ({...f, gender: e.target.value}))}>
                    <option value="MALE">männlich</option>
                    <option value="FEMALE">weiblich</option>
                    <option value="DIVERSE">divers</option>
                  </select>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Kontakt (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Telefon</label>
                    <input className="input" placeholder="+43 123 456 789"
                      value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">E-Mail</label>
                    <input type="email" className="input" placeholder="patient@email.at"
                      value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Admin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Versicherungsträger</label>
                  <input className="input" placeholder="ÖGK, SVS, BVAEB…"
                    value={form.insuranceProvider} onChange={e => setForm(f => ({...f, insuranceProvider: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Zuweiser</label>
                  <input className="input" placeholder="Dr. Mustermann"
                    value={form.referralSource} onChange={e => setForm(f => ({...f, referralSource: e.target.value}))} />
                </div>
              </div>

              {/* Abrechnung */}
              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Abrechnung</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Einheitenmodus</label>
                    <select className="input" value={form.defaultBillingMode}
                      onChange={e => setForm(f => ({...f, defaultBillingMode: e.target.value}))}>
                      <option value="time">Zeitmodus (Minuten)</option>
                      <option value="unit">Einheitenmodus (Einheiten)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Einheitendauer (Min.)</label>
                    <input type="number" className="input" value={form.defaultUnitDuration}
                      onChange={e => setForm(f => ({...f, defaultUnitDuration: +e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Kosten/Einheit (€)</label>
                    <input type="number" step="0.01" className="input" placeholder="z.B. 80.00"
                      value={form.defaultUnitPriceNet}
                      onChange={e => setForm(f => ({...f, defaultUnitPriceNet: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Startzahl Sessionzähler</label>
                    <input type="number" min="0" className="input" value={form.sessionStartNumber}
                      onChange={e => setForm(f => ({...f, sessionStartNumber: +e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* PIN-Login */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-primary-light)] border border-indigo-100">
                <input type="checkbox" id="createLogin" checked={form.createLogin}
                  onChange={e => setForm(f => ({...f, createLogin: e.target.checked}))}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600" />
                <label htmlFor="createLogin" className="cursor-pointer">
                  <p className="text-sm font-medium text-indigo-800">PIN-Login erstellen</p>
                  <p className="text-xs text-[var(--color-primary)] mt-0.5">Patient kann den Fragebogen selbst mit PIN ausfüllen</p>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button
                onClick={createPatient}
                disabled={loading || !form.firstName || !form.lastName || !form.dob}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Anlegen…</> : 'Patient anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: PIN anzeigen ── */}
      {newPin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-7 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Patient angelegt</h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">PIN für den Patienten-Login — bitte sicher aufbewahren:</p>

            <div className="relative mb-5">
              <div className="text-4xl font-mono font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] border border-[var(--border)]
                              rounded-2xl py-5 tracking-[0.3em] select-all">
                {newPin}
              </div>
              <button
                onClick={copyPin}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors"
                title="Kopieren"
              >
                {pinCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] mb-5">
              Mit dieser PIN kann der Patient unter <span className="font-mono text-slate-600">{typeof window !== 'undefined' ? window.location.origin : ''}</span> einloggen und Fragebögen ausfüllen.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => { setNewPin(null); setCreating(false); router.refresh() }}
                className="btn-secondary flex-1"
              >
                Zur Patientenliste
              </button>
              <button
                onClick={() => { setNewPin(null); setCreating(false); if (newPatientId) router.push(`/patients/${newPatientId}`) }}
                className="btn-primary flex-1 justify-center"
              >
                Zur Patientenakte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
