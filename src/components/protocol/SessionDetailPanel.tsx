'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  X, Trash2, FileText, Euro, MoreHorizontal, Plus, Save,
  Mic, Upload, Ban, CheckCircle, AlertCircle, ChevronDown
} from 'lucide-react'
import { ProtocolEditor } from '@/components/protocol/ProtocolEditor'

// ── Typen ────────────────────────────────────────────────────────────────────

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

interface SessionDetailProps {
  session: any
  patientId: string
  role: string
  onClose: () => void
  onDeleted: () => void
  onUpdated: () => void
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function fmtEUR(n: number | string | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n.toString()))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
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
  { value: 'diagnose',       label: 'Diagnose' },
  { value: 'testverfahren',  label: 'Testverfahren' },
  { value: 'zusatzleistung', label: 'Zusatzleistung' },
  { value: 'freitext',       label: 'Freie Position' },
]

const DIENSTLEISTUNGEN = [
  'Psychotherapeutische Behandlung',
  'Erstgespräch / Diagnostik',
  'Gruppentherapie',
  'Krisenintervention',
  'Supervision',
  'Gutachten',
]

// ── Bewertungs-Slider Komponente ─────────────────────────────────────────────

function RatingSlider({
  label, name, value, onChange,
}: {
  label: string
  name: string
  value: number | null
  onChange: (name: string, value: number | null) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ width: 160, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(name, value === i ? null : i)}
            style={{
              width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
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

// ── Haupt-Komponente ─────────────────────────────────────────────────────────

export function SessionDetailPanel({
  session, patientId, role, onClose, onDeleted, onUpdated,
}: SessionDetailProps) {
  type DetailTab = 'kurzprotokoll' | 'langprotokoll' | 'leistungen' | 'weiteres'
  const [tab, setTab] = useState<DetailTab>('kurzprotokoll')
  const [deleting, setDeleting] = useState(false)
  const [excluding, setExcluding] = useState(false)

  // ── Leistungen ──
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [newLine, setNewLine] = useState({
    description: '', quantity: 1, unitPriceNet: 0, vatRate: 0, category: 'freitext', catalogCode: '',
  })
  const [savingLine, setSavingLine] = useState(false)
  const [showLineForm, setShowLineForm] = useState(false)

  // ── Weiteres: Bewertungen ──
  const DEFAULT_ASSESSMENTS: AssessmentValue[] = [
    { assessmentName: 'motivation',   value: null },
    { assessmentName: 'punctuality',  value: null },
    { assessmentName: 'joie_de_vivre', value: null },
  ]
  const ASSESSMENT_LABELS: Record<string, string> = {
    motivation:    'Motivation',
    punctuality:   'Pünktlichkeit',
    joie_de_vivre: 'Lebensfreude',
  }
  const [assessments, setAssessments] = useState<AssessmentValue[]>(DEFAULT_ASSESSMENTS)
  const [savingAssessments, setSavingAssessments] = useState(false)
  const [savedAssessments, setSavedAssessments] = useState(false)

  // ── Weiteres: Dienstleistung & Fahrtenbuch ──
  const [serviceLabel, setServiceLabel] = useState(session.serviceLabel ?? 'Psychotherapeutische Behandlung')
  const [savingServiceLabel, setSavingServiceLabel] = useState(false)
  const [travel, setTravel] = useState({ from: '', to: '', distanceKm: 0, purpose: '', returnTrip: false })
  const [savingTravel, setSavingTravel] = useState(false)
  const [savedTravel, setSavedTravel] = useState(false)

  // ── Daten laden ─────────────────────────────────────────────────────────────

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
    if (tab === 'weiteres') loadAssessments()
  }, [tab, loadServiceLines, loadAssessments])

  // ── Aktionen ─────────────────────────────────────────────────────────────────

  async function deleteSession() {
    if (!confirm(`Sitzung "${session.name}" wirklich löschen?`)) return
    setDeleting(true)
    const res = await fetch(`/api/therapy-sessions/${session.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted() } else {
      const d = await res.json()
      alert(d.error ?? 'Fehler beim Löschen')
      setDeleting(false)
    }
  }

  async function toggleExclude() {
    const newExclude = session.billingStatus !== 'EXCLUDED'
    if (newExclude) {
      if (!confirm('Diese Sitzung von der automatischen Transaktionserstellung ausnehmen?')) return
    }
    setExcluding(true)
    await fetch(`/api/therapy-sessions/${session.id}/exclude`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exclude: newExclude }),
    })
    setExcluding(false)
    onUpdated()
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
    onUpdated()
  }

  async function saveTravelEntry() {
    if (!travel.from || !travel.to) return
    setSavingTravel(true)
    // Über Finance-Fahrtenbuch speichern
    const km = travel.returnTrip ? travel.distanceKm * 2 : travel.distanceKm
    await fetch('/api/finance/mileage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departure: travel.from,
        destination: travel.to,
        kilometers: km,
        returnTrip: travel.returnTrip,
        purpose: 'PATIENT_VISIT',
        purposeNote: travel.purpose || `Session: ${session.name}`,
        date: session.sessionDate,
        patientId,
      }),
    })
    setSavingTravel(false)
    setSavedTravel(true)
    setTimeout(() => setSavedTravel(false), 2500)
    setTravel({ from: '', to: '', distanceKm: 0, purpose: '', returnTrip: false })
  }

  // ── Summen ───────────────────────────────────────────────────────────────────

  const basePrice = parseFloat(session.calculatedPriceNet ?? 0)
  const extraTotal = serviceLines.reduce((s, l) => s + Number(l.amountNet), 0)
  const totalNet = basePrice + extraTotal

  const isLocked = session.billingStatus === 'PAID'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 900, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sessionkopf ── */}
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{session.name}</h2>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>📅 {fmtDate(session.sessionDate)}</span>
                {session.durationMinutes && <span>⏱ {fmtMins(session.durationMinutes)}</span>}
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                  {session.billingMode === 'unit'
                    ? `${session.unitCount} × ${fmtEUR(session.unitPriceNet)} = ${fmtEUR(session.calculatedPriceNet)}`
                    : fmtEUR(session.calculatedPriceNet)
                  }
                </span>
                <span className={`badge ${BILLING_STATUS_CLASS[session.billingStatus]}`}>
                  {BILLING_STATUS_LABEL[session.billingStatus]}
                </span>
                {session.protocols?.some((p: any) => p.type === 'SHORT') && (
                  <span className="badge badge-indigo" style={{ fontSize: 10 }}>📄 Protokoll</span>
                )}
                {session._count?.audioRecordings > 0 && (
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>🎙 Audio</span>
                )}
              </div>
            </div>
            {/* Aktionen Kopf */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!isLocked && (
                <button
                  onClick={toggleExclude}
                  disabled={excluding}
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  title={session.billingStatus === 'EXCLUDED' ? 'Wieder in Finanzen aufnehmen' : 'Von Finanzen ausnehmen'}
                >
                  <Ban style={{ width: 12, height: 12 }} />
                  {session.billingStatus === 'EXCLUDED' ? 'Einschließen' : 'Ausnehmen'}
                </button>
              )}
              <button
                onClick={deleteSession}
                disabled={deleting || isLocked}
                className="btn-danger"
                style={{ fontSize: 11, padding: '4px 8px' }}
                title={isLocked ? 'Bezahlte Sitzungen können nicht gelöscht werden' : 'Sitzung löschen'}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
              <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 0,
          background: 'var(--surface-card)',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
        }}>
          {([
            ['kurzprotokoll',  'Kurzprotokoll'],
            ['langprotokoll',  'Langprotokoll'],
            ['leistungen',     'Leistungen'],
            ['weiteres',       'Weiteres'],
          ] as [DetailTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === key ? 600 : 400,
                color: tab === key ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab-Inhalt ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

          {/* ── KURZPROTOKOLL ── */}
          {tab === 'kurzprotokoll' && (
            <ProtocolEditor sessionId={session.id} type="SHORT" role={role} readOnly={isLocked} />
          )}

          {/* ── LANGPROTOKOLL ── */}
          {tab === 'langprotokoll' && (
            <ProtocolEditor sessionId={session.id} type="LONG" role={role} readOnly={isLocked} />
          )}

          {/* ── LEISTUNGEN ── */}
          {tab === 'leistungen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Basispreis */}
              <div style={{
                padding: '10px 14px', background: 'var(--color-primary-light)',
                borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Normale Session-Kosten</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {session.billingMode === 'time'
                      ? `${session.durationMinutes} min × ${fmtEUR((parseFloat(session.hourlyRateNet ?? 0) / 60).toFixed(4))}/min`
                      : `${session.unitCount} Einheiten × ${fmtEUR(session.unitPriceNet)}`
                    }
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
                  {fmtEUR(basePrice)}
                </span>
              </div>

              {/* Zusatzleistungen */}
              {loadingLines ? (
                <div className="empty-state"><div className="spinner" style={{ width: 20, height: 20 }} /></div>
              ) : serviceLines.length > 0 && (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead><tr>
                      <th>Beschreibung</th>
                      <th style={{ width: 70 }}>Menge</th>
                      <th style={{ width: 90 }}>Preis/Einh.</th>
                      <th style={{ width: 90 }}>Gesamt</th>
                      {!isLocked && <th style={{ width: 40 }}></th>}
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
                              <button
                                onClick={() => deleteServiceLine(line.id)}
                                className="btn-ghost"
                                style={{ padding: 4, color: 'var(--red)' }}
                              >
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

              {/* Gesamtsumme */}
              {(serviceLines.length > 0 || extraTotal > 0) && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: 8,
                  padding: '8px 14px', background: 'var(--surface-panel)', borderRadius: 8,
                  fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gesamt Netto:</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmtEUR(totalNet)}</span>
                </div>
              )}

              {/* Neue Leistung hinzufügen */}
              {!isLocked && (
                <div>
                  {!showLineForm ? (
                    <button onClick={() => setShowLineForm(true)} className="btn-secondary" style={{ fontSize: 12 }}>
                      <Plus style={{ width: 13, height: 13 }} /> Zusatzleistung hinzufügen
                    </button>
                  ) : (
                    <div style={{
                      padding: 14, background: 'var(--surface-panel)', borderRadius: 10,
                      border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
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
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Vorschau: {fmtEUR(newLine.quantity * newLine.unitPriceNet)} netto
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowLineForm(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
                        <button
                          onClick={addServiceLine}
                          disabled={savingLine || !newLine.description}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          {savingLine ? 'Speichern...' : 'Hinzufügen'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isLocked && (
                <div style={{
                  padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 8,
                  fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertCircle style={{ width: 13, height: 13 }} />
                  Bezahlte Sitzungen können nur über Korrektur/Storno geändert werden.
                </div>
              )}
            </div>
          )}

          {/* ── WEITERES ── */}
          {tab === 'weiteres' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Beurteilungen */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                  Beurteilungen
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                <div style={{ marginTop: 10 }}>
                  <button onClick={saveAssessments} disabled={savingAssessments} className="btn-primary" style={{ fontSize: 12 }}>
                    {savingAssessments ? 'Speichern...' : savedAssessments ? <><CheckCircle style={{ width: 12, height: 12 }} /> Gespeichert</> : <><Save style={{ width: 12, height: 12 }} /> Beurteilungen speichern</>}
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Dienstleistungsbezeichnung */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Bezeichnung der Dienstleistung
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="input"
                    style={{ flex: 1 }}
                    value={serviceLabel}
                    onChange={e => setServiceLabel(e.target.value)}
                  >
                    {DIENSTLEISTUNGEN.map(d => <option key={d} value={d}>{d}</option>)}
                    {!DIENSTLEISTUNGEN.includes(serviceLabel) && serviceLabel && (
                      <option value={serviceLabel}>{serviceLabel}</option>
                    )}
                  </select>
                  <button
                    onClick={saveServiceLabel}
                    disabled={savingServiceLabel}
                    className="btn-primary"
                    style={{ fontSize: 12 }}
                  >
                    <Save style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Fahrtenbuch-Eintrag */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                  Fahrtenbuch-Eintrag
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="returnTrip"
                      checked={travel.returnTrip}
                      onChange={e => setTravel(t => ({ ...t, returnTrip: e.target.checked }))}
                    />
                    <label htmlFor="returnTrip" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                      Retour? (Distanz wird verdoppelt → {fmtEUR((travel.returnTrip ? travel.distanceKm * 2 : travel.distanceKm) * 0.42)} bei € 0,42/km)
                    </label>
                  </div>
                  <div>
                    <button
                      onClick={saveTravelEntry}
                      disabled={savingTravel || !travel.from || !travel.to}
                      className="btn-primary"
                      style={{ fontSize: 12 }}
                    >
                      {savingTravel ? 'Speichern...' : savedTravel ? <><CheckCircle style={{ width: 12, height: 12 }} /> Gespeichert</> : <><Save style={{ width: 12, height: 12 }} /> Fahrtenbuch speichern</>}
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
