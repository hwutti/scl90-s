'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Trash2, FileText, Euro, MoreHorizontal, Plus, Save,
  Ban, CheckCircle, AlertCircle, X, Calendar, Clock, Hash,
  User, ChevronRight, Mic, ClipboardList,
} from 'lucide-react'
import { ProtocolEditor } from '@/components/protocol/ProtocolEditor'

// ── Typen ─────────────────────────────────────────────────────────────────────

interface ServiceLine {
  id: string
  description: string
  quantity: number
  unitPriceNet: number
  vatRate: number
  amountNet: number
  amountGross: number
  category: string | null
  catalogCode: string | null
  sortOrder: number
}

interface AssessmentValue {
  assessmentName: string
  value: number | null
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtEUR(n: number | string | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n.toString()))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'long' }).format(new Date(d))
}
function fmtMins(m: number | null | undefined) {
  if (!m) return '—'
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 > 0 ? m % 60 + 'min' : ''}`.trim() : `${m} min`
}

const BILLING_STATUS_LABEL: Record<string, string> = {
  UNBILLED: 'Nicht verrechnet',
  BILLED_UNPAID: 'Verrechnet (offen)',
  PAID: 'Bezahlt',
  EXCLUDED: 'Ausgeschlossen',
}
const BILLING_STATUS_CLASS: Record<string, string> = {
  UNBILLED: 'badge-gray',
  BILLED_UNPAID: 'badge-amber',
  PAID: 'badge-green',
  EXCLUDED: 'badge-gray',
}

const SERVICE_CATEGORIES = [
  { value: 'diagnose', label: 'Diagnose' },
  { value: 'testverfahren', label: 'Testverfahren' },
  { value: 'zusatzleistung', label: 'Zusatzleistung' },
  { value: 'freitext', label: 'Freie Position' },
]

const DIENSTLEISTUNGEN = [
  'Psychotherapeutische Behandlung',
  'Erstgespräch / Diagnostik',
  'Gruppentherapie',
  'Krisenintervention',
  'Supervision',
  'Gutachten',
]

type DetailTab = 'kurzprotokoll' | 'langprotokoll' | 'leistungen' | 'bewertungen' | 'weiteres'

const NAV_ITEMS: { key: DetailTab; label: string; icon: any }[] = [
  { key: 'kurzprotokoll', label: 'Kurzprotokoll', icon: FileText },
  { key: 'langprotokoll', label: 'Langprotokoll', icon: ClipboardList },
  { key: 'leistungen', label: 'Leistungen', icon: Euro },
  { key: 'bewertungen', label: 'Bewertungen', icon: MoreHorizontal },
  { key: 'weiteres', label: 'Weiteres', icon: MoreHorizontal },
]

// ── Bewertungs-Slider ─────────────────────────────────────────────────────────

function RatingSlider({
  label, name, value, onChange,
}: {
  label: string; name: string; value: number | null
  onChange: (name: string, value: number | null) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ width: 160, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(name, value === i ? null : i)}
            style={{
              width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: value === i ? 'var(--color-primary)' : 'var(--surface-panel)',
              color: value === i ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {i}
          </button>
        ))}
      </div>
      {value !== null && value !== undefined && (
        <button
          onClick={() => onChange(name, null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          title="Löschen"
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function SitzungDetailClient({
  patient, therapySession, totalSessions, role,
}: {
  patient: any
  therapySession: any
  totalSessions: number
  role: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<DetailTab>('kurzprotokoll')
  const [deleting, setDeleting] = useState(false)
  const [excluding, setExcluding] = useState(false)
  const [session, setSession] = useState(therapySession)

  // ── Leistungen ──
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>(therapySession.serviceLines ?? [])
  const [loadingLines, setLoadingLines] = useState(false)
  const [newLine, setNewLine] = useState({
    description: '', quantity: 1, unitPriceNet: 0, vatRate: 0, category: 'freitext', catalogCode: '',
  })
  const [savingLine, setSavingLine] = useState(false)
  const [showLineForm, setShowLineForm] = useState(false)

  // ── Bewertungen ──
  const DEFAULT_ASSESSMENTS: AssessmentValue[] = [
    { assessmentName: 'motivation', value: null },
    { assessmentName: 'punctuality', value: null },
    { assessmentName: 'joie_de_vivre', value: null },
  ]
  const ASSESSMENT_LABELS: Record<string, string> = {
    motivation: 'Motivation',
    punctuality: 'Pünktlichkeit',
    joie_de_vivre: 'Lebensfreude',
  }
  const [assessments, setAssessments] = useState<AssessmentValue[]>(DEFAULT_ASSESSMENTS)
  const [savingAssessments, setSavingAssessments] = useState(false)
  const [savedAssessments, setSavedAssessments] = useState(false)

  // ── Weiteres ──
  const [serviceLabel, setServiceLabel] = useState(session.serviceLabel ?? 'Psychotherapeutische Behandlung')
  const [savingServiceLabel, setSavingServiceLabel] = useState(false)
  const [travel, setTravel] = useState({ from: '', to: '', distanceKm: 0, purpose: '', returnTrip: false })
  const [savingTravel, setSavingTravel] = useState(false)
  const [savedTravel, setSavedTravel] = useState(false)

  const patientName = `${patient.firstName} ${patient.lastName}`
  const backUrl = `/patients/${patient.id}?tab=sitzungen`
  const isLocked = session.billingStatus === 'PAID'

  // ── Daten laden ───────────────────────────────────────────────────────────────

  const loadServiceLines = useCallback(async () => {
    setLoadingLines(true)
    try {
      const data = await fetch(`/api/therapy-sessions/${session.id}/service-lines`).then(r => r.json())
      setServiceLines(Array.isArray(data) ? data : [])
    } catch { setServiceLines([]) }
    setLoadingLines(false)
  }, [session.id])

  const loadAssessments = useCallback(async () => {
    try {
      const data = await fetch(`/api/therapy-sessions/${session.id}/assessment-values`).then(r => r.json())
      if (Array.isArray(data) && data.length > 0) {
        setAssessments(DEFAULT_ASSESSMENTS.map(d => {
          const found = data.find((v: any) => v.assessmentName === d.assessmentName)
          return found ? { assessmentName: d.assessmentName, value: found.value } : d
        }))
      }
    } catch { /* ignore */ }
  }, [session.id])

  useEffect(() => {
    if (tab === 'leistungen') loadServiceLines()
    if (tab === 'bewertungen') loadAssessments()
  }, [tab, loadServiceLines, loadAssessments])

  // ── Aktionen ──────────────────────────────────────────────────────────────────

  async function deleteSession() {
    if (!confirm(`Sitzung "${session.name}" wirklich löschen?`)) return
    setDeleting(true)
    const res = await fetch(`/api/therapy-sessions/${session.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(backUrl)
    } else {
      const d = await res.json()
      alert(d.error ?? 'Fehler beim Löschen')
      setDeleting(false)
    }
  }

  async function toggleExclude() {
    const newExclude = session.billingStatus !== 'EXCLUDED'
    if (newExclude && !confirm('Diese Sitzung von der automatischen Rechnungserstellung ausnehmen?')) return
    setExcluding(true)
    await fetch(`/api/therapy-sessions/${session.id}/exclude`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exclude: newExclude }),
    })
    setExcluding(false)
    // Session lokal aktualisieren
    setSession((s: any) => ({
      ...s,
      billingStatus: newExclude ? 'EXCLUDED' : 'UNBILLED',
    }))
  }

  async function addServiceLine() {
    if (!newLine.description) return
    setSavingLine(true)
    await fetch(`/api/therapy-sessions/${session.id}/service-lines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLine),
    })
    setSavingLine(false)
    setShowLineForm(false)
    setNewLine({ description: '', quantity: 1, unitPriceNet: 0, vatRate: 0, category: 'freitext', catalogCode: '' })
    loadServiceLines()
  }

  async function deleteServiceLine(lineId: string) {
    await fetch(`/api/therapy-sessions/${session.id}/service-lines/${lineId}`, { method: 'DELETE' })
    loadServiceLines()
  }

  async function saveAssessments() {
    setSavingAssessments(true)
    await fetch(`/api/therapy-sessions/${session.id}/assessment-values`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: assessments }),
    })
    setSavingAssessments(false)
    setSavedAssessments(true)
    setTimeout(() => setSavedAssessments(false), 2500)
  }

  async function saveServiceLabel() {
    setSavingServiceLabel(true)
    await fetch(`/api/therapy-sessions/${session.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceLabel }),
    })
    setSavingServiceLabel(false)
  }

  async function saveTravelEntry() {
    if (!travel.from || !travel.to) return
    setSavingTravel(true)
    const km = travel.returnTrip ? travel.distanceKm * 2 : travel.distanceKm
    await fetch('/api/finance/mileage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departure: travel.from,
        destination: travel.to,
        kilometers: km,
        returnTrip: travel.returnTrip,
        purpose: 'PATIENT_VISIT',
        purposeNote: travel.purpose || `Sitzung: ${session.name}`,
        date: session.sessionDate,
        patientId: patient.id,
      }),
    })
    setSavingTravel(false)
    setSavedTravel(true)
    setTimeout(() => setSavedTravel(false), 2500)
    setTravel({ from: '', to: '', distanceKm: 0, purpose: '', returnTrip: false })
  }

  const basePrice = parseFloat(session.calculatedPriceNet ?? 0)
  const extraTotal = serviceLines.reduce((s, l) => s + Number(l.amountNet), 0)
  const totalNet = basePrice + extraTotal

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: 'var(--surface-card)',
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push(backUrl)}
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Zurück zur Akte
        </button>

        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />

        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{patientName}</span>

        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />

        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{session.name}</span>

        <span className={`badge ${BILLING_STATUS_CLASS[session.billingStatus]}`} style={{ marginLeft: 4 }}>
          {BILLING_STATUS_LABEL[session.billingStatus]}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!isLocked && (
            <button
              onClick={toggleExclude}
              disabled={excluding}
              className="btn-secondary"
              style={{ fontSize: 12, padding: '5px 10px' }}
            >
              <Ban style={{ width: 13, height: 13 }} />
              {session.billingStatus === 'EXCLUDED' ? 'Einschließen' : 'Ausnehmen'}
            </button>
          )}
          <button
            onClick={deleteSession}
            disabled={deleting || isLocked}
            className="btn-danger"
            style={{ fontSize: 12, padding: '5px 10px' }}
            title={isLocked ? 'Bezahlte Sitzungen können nicht gelöscht werden' : 'Sitzung löschen'}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* ── Zweispalten-Layout ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: 240, flexShrink: 0,
          background: 'var(--surface-card)',
          borderRight: '0.5px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Sitzungs-Metadaten */}
          <div style={{ padding: '16px 14px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Sitzung
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Calendar style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}>{fmtDate(session.sessionDate)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Clock style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}>{fmtMins(session.durationMinutes)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Euro style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {session.billingMode === 'unit'
                    ? `${session.unitCount} × ${fmtEUR(session.unitPriceNet)}`
                    : fmtEUR(session.calculatedPriceNet)
                  }
                </span>
              </div>
              {session.referenceNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <Hash style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                    {session.referenceNumber}
                  </span>
                </div>
              )}
              {session._count?.audioRecordings > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Mic style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {session._count.audioRecordings} Audio-Aufnahme{session._count.audioRecordings !== 1 ? 'n' : ''}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 14px' }} />

          {/* Navigation */}
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 14px', marginBottom: 4 }}>
              Bereiche
            </div>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px', background: active ? 'var(--color-primary-light)' : 'none', border: 'none',
                    borderLeft: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                    cursor: 'pointer', fontSize: 13, textAlign: 'left' as const,
                    color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 14px' }} />

          {/* Patient */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Patient
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <User style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
              <button
                onClick={() => router.push(`/patients/${patient.id}`)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, padding: 0, textAlign: 'left' }}
              >
                {patientName}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 22 }}>
              {totalSessions} Sitzung{totalSessions !== 1 ? 'en' : ''} gesamt
            </div>
          </div>
        </div>

        {/* ── Hauptinhalt ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--surface-page)' }}>

          {/* ── KURZPROTOKOLL ── */}
          {tab === 'kurzprotokoll' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>
                Kurzprotokoll
              </h2>
              <ProtocolEditor sessionId={session.id} type="SHORT" role={role} readOnly={isLocked} />
            </div>
          )}

          {/* ── LANGPROTOKOLL ── */}
          {tab === 'langprotokoll' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>
                Langprotokoll
              </h2>
              <ProtocolEditor sessionId={session.id} type="LONG" role={role} readOnly={isLocked} />
            </div>
          )}

          {/* ── LEISTUNGEN ── */}
          {tab === 'leistungen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Leistungen</h2>

              <div style={{
                padding: '12px 16px', background: 'var(--color-primary-light)',
                borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Sitzungskosten</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {session.billingMode === 'time'
                      ? `Pauschalpreis pro Sitzung (${session.durationMinutes} min, keine Dauer-Skalierung)`
                      : `${session.unitCount} Einheiten × ${fmtEUR(session.unitPriceNet)}`
                    }
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-primary)' }}>
                  {fmtEUR(basePrice)}
                </span>
              </div>

              {loadingLines ? (
                <div className="empty-state"><div className="spinner" style={{ width: 20, height: 20 }} /></div>
              ) : serviceLines.length > 0 && (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead><tr>
                      <th>Beschreibung</th>
                      <th style={{ width: 70 }}>Menge</th>
                      <th style={{ width: 100 }}>Preis/Einh.</th>
                      <th style={{ width: 100 }}>Gesamt</th>
                      {!isLocked && <th style={{ width: 50 }}></th>}
                    </tr></thead>
                    <tbody>
                      {serviceLines.map(line => (
                        <tr key={line.id}>
                          <td>
                            <div className="primary">{line.description}</div>
                            {line.catalogCode && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{line.catalogCode}</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{fmtEUR(line.unitPriceNet)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtEUR(line.amountNet)}</td>
                          {!isLocked && (
                            <td>
                              <button onClick={() => deleteServiceLine(line.id)} className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }}>
                                <Trash2 style={{ width: 13, height: 13 }} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(serviceLines.length > 0 || extraTotal > 0) && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: 12,
                  padding: '10px 16px', background: 'var(--surface-panel)', borderRadius: 8, fontSize: 14,
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gesamt Netto:</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmtEUR(totalNet)}</span>
                </div>
              )}

              {!isLocked && (
                <div>
                  {!showLineForm ? (
                    <button onClick={() => setShowLineForm(true)} className="btn-secondary" style={{ fontSize: 13 }}>
                      <Plus style={{ width: 14, height: 14 }} /> Zusatzleistung hinzufügen
                    </button>
                  ) : (
                    <div style={{
                      padding: 16, background: 'var(--surface-panel)', borderRadius: 10,
                      border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                      <div className="form-grid-2">
                        <div style={{ gridColumn: '1/-1' }}>
                          <label className="label">Beschreibung *</label>
                          <input className="input" value={newLine.description}
                            onChange={e => setNewLine(l => ({ ...l, description: e.target.value }))}
                            placeholder="z.B. ICD-10 Diagnosekodierung, PHQ-9 Auswertung ..." />
                        </div>
                        <div>
                          <label className="label">Kategorie</label>
                          <select className="input" value={newLine.category}
                            onChange={e => setNewLine(l => ({ ...l, category: e.target.value }))}>
                            {SERVICE_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Katalogcode (GOÄ/GebüH, optional)</label>
                          <input className="input" value={newLine.catalogCode}
                            onChange={e => setNewLine(l => ({ ...l, catalogCode: e.target.value }))}
                            placeholder="z.B. GOÄ 835" />
                        </div>
                        <div>
                          <label className="label">Menge</label>
                          <input type="number" className="input" step="0.5" min="0.5" value={newLine.quantity}
                            onChange={e => setNewLine(l => ({ ...l, quantity: parseFloat(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="label">Preis / Einheit (€ Netto)</label>
                          <input type="number" className="input" step="0.01" min="0" value={newLine.unitPriceNet}
                            onChange={e => setNewLine(l => ({ ...l, unitPriceNet: parseFloat(e.target.value) }))} />
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Vorschau: {fmtEUR(newLine.quantity * newLine.unitPriceNet)} netto
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowLineForm(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
                        <button onClick={addServiceLine} disabled={savingLine || !newLine.description} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                          {savingLine ? 'Speichern...' : 'Hinzufügen'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isLocked && (
                <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle style={{ width: 14, height: 14 }} />
                  Bezahlte Sitzungen können nur über Korrektur/Storno geändert werden.
                </div>
              )}
            </div>
          )}

          {/* ── BEWERTUNGEN ── */}
          {tab === 'bewertungen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Beurteilungen</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {assessments.map(a => (
                  <RatingSlider
                    key={a.assessmentName}
                    label={ASSESSMENT_LABELS[a.assessmentName] ?? a.assessmentName}
                    name={a.assessmentName}
                    value={a.value}
                    onChange={(name, value) =>
                      setAssessments(prev => prev.map(p => p.assessmentName === name ? { ...p, value } : p))
                    }
                  />
                ))}
              </div>
              <div>
                <button onClick={saveAssessments} disabled={savingAssessments} className="btn-primary" style={{ fontSize: 13 }}>
                  {savingAssessments ? 'Speichern...'
                    : savedAssessments ? <><CheckCircle style={{ width: 13, height: 13 }} /> Gespeichert</>
                    : <><Save style={{ width: 13, height: 13 }} /> Beurteilungen speichern</>}
                </button>
              </div>
            </div>
          )}

          {/* ── WEITERES ── */}
          {tab === 'weiteres' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Weiteres</h2>

              {/* Dienstleistungsbezeichnung */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                  Bezeichnung der Dienstleistung
                </div>
                <div style={{ display: 'flex', gap: 8, maxWidth: 500 }}>
                  <select className="input" style={{ flex: 1 }} value={serviceLabel}
                    onChange={e => setServiceLabel(e.target.value)}>
                    {DIENSTLEISTUNGEN.map(d => <option key={d} value={d}>{d}</option>)}
                    {!DIENSTLEISTUNGEN.includes(serviceLabel) && serviceLabel && (
                      <option value={serviceLabel}>{serviceLabel}</option>
                    )}
                  </select>
                  <button onClick={saveServiceLabel} disabled={savingServiceLabel} className="btn-primary" style={{ fontSize: 13 }}>
                    <Save style={{ width: 13, height: 13 }} /> Speichern
                  </button>
                </div>
              </div>

              <div style={{ height: '0.5px', background: 'var(--border)' }} />

              {/* Fahrtenbuch */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                  Fahrtenbuch-Eintrag
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600 }}>
                  <div className="form-grid-2">
                    <div>
                      <label className="label">Von</label>
                      <input className="input" value={travel.from}
                        onChange={e => setTravel(t => ({ ...t, from: e.target.value }))}
                        placeholder="Abfahrtsort" />
                    </div>
                    <div>
                      <label className="label">Bis / Nach</label>
                      <input className="input" value={travel.to}
                        onChange={e => setTravel(t => ({ ...t, to: e.target.value }))}
                        placeholder="Zielort" />
                    </div>
                    <div>
                      <label className="label">Distanz (km)</label>
                      <input type="number" className="input" step="0.1" min="0" value={travel.distanceKm}
                        onChange={e => setTravel(t => ({ ...t, distanceKm: parseFloat(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Zweck</label>
                      <input className="input" value={travel.purpose}
                        onChange={e => setTravel(t => ({ ...t, purpose: e.target.value }))}
                        placeholder="z.B. Hausbesuch" />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={travel.returnTrip}
                      onChange={e => setTravel(t => ({ ...t, returnTrip: e.target.checked }))} />
                    <span>
                      Retour (Distanz wird verdoppelt → {fmtEUR((travel.returnTrip ? travel.distanceKm * 2 : travel.distanceKm) * 0.42)} bei € 0,42/km)
                    </span>
                  </label>
                  <div>
                    <button onClick={saveTravelEntry} disabled={savingTravel || !travel.from || !travel.to} className="btn-primary" style={{ fontSize: 13 }}>
                      {savingTravel ? 'Speichern...'
                        : savedTravel ? <><CheckCircle style={{ width: 13, height: 13 }} /> Gespeichert</>
                        : <><Save style={{ width: 13, height: 13 }} /> Fahrtenbuch speichern</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
