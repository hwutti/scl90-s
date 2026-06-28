'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, FileText, ClipboardList, MessageSquare, ChevronLeft, Plus,
  AlertCircle, Edit3, Save, X, Camera, Calendar, Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'stammdaten' | 'screening' | 'therapieplan' | 'diagnosen' | 'dokumente' | 'termine' | 'verlauf'
const GENDER_LABEL: Record<string,string> = { MALE: 'maennlich', FEMALE: 'weiblich', DIVERSE: 'divers' }

function calcAge(dob: string) {
  const d = new Date(dob + 'T00:00:00')
  let age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--
  return age
}
function fmtDate(s: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(s))
}

const TABS: { key: Tab; label: string; icon: any; count?: (p: any) => number }[] = [
  { key: 'stammdaten',  label: 'Stammdaten',  icon: User },
  { key: 'screening',   label: 'Screening',   icon: Activity, count: p => p.assessments?.length ?? 0 },
  { key: 'therapieplan',label: 'Therapieplan',icon: ClipboardList },
  { key: 'diagnosen',   label: 'Diagnosen',   icon: FileText },
  { key: 'dokumente',   label: 'Dokumente',   icon: FileText },
  { key: 'termine',     label: 'Termine',     icon: Calendar },
  { key: 'verlauf',     label: 'Verlauf',     icon: MessageSquare, count: p => p.sessionNotes?.length ?? 0 },
]

export function PatientRecordClient({ patient, notes, instruments, currentUserId, role }: any) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('stammdaten')
  const [editRecord, setEditRecord] = useState(false)
  const [recordForm, setRecordForm] = useState({
    chiefComplaint: patient.record?.chiefComplaint ?? '',
    medicalHistory: patient.record?.medicalHistory ?? '',
    medication: patient.record?.medication ?? '',
    allergies: patient.record?.allergies ?? '',
    familyHistory: patient.record?.familyHistory ?? '',
    socialHistory: patient.record?.socialHistory ?? '',
    therapyGoals: patient.record?.therapyGoals ?? '',
    therapyStart: patient.record?.therapyStart?.slice?.(0,10) ?? '',
    sessionFrequency: patient.record?.sessionFrequency ?? '',
    notes: patient.record?.notes ?? '',
  })
  const [savingRecord, setSavingRecord] = useState(false)
  const [noteForm, setNoteForm] = useState({ date: new Date().toISOString().slice(0,10), noteType: 'PROGRESS', content: '' })
  const [newNote, setNewNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [assessForm, setAssessForm] = useState({ instrumentId: instruments[0]?.id ?? '', occasion: '' })
  const [newAssessment, setNewAssessment] = useState(false)
  const [savingAssessment, setSavingAssessment] = useState(false)

  const age = calcAge(patient.dob)
  const latestScored = patient.assessments?.find((a: any) => a.status === 'SCORED' || a.status === 'LOCKED')
  const latestScores = latestScored?.result?.scores as any
  const isClinical = latestScored?.result?.isClinicalCase
  const gsiT = latestScores?.GSI?.tScore

  async function saveRecord() {
    setSavingRecord(true)
    await fetch('/api/patients/' + patient.id + '/record', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recordForm) })
    setSavingRecord(false); setEditRecord(false); router.refresh()
  }
  async function addNote() {
    setSavingNote(true)
    await fetch('/api/patients/' + patient.id + '/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noteForm) })
    setSavingNote(false); setNewNote(false); router.refresh()
  }
  async function addAssessment() {
    setSavingAssessment(true)
    const res = await fetch('/api/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: patient.id, ...assessForm }) })
    const data = await res.json()
    setSavingAssessment(false); setNewAssessment(false)
    if (data.id) router.push('/assessment/' + data.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--surface-page)' }}>
      {/* Topbar */}
      <div className="topbar">
        <button onClick={() => router.push('/patients')} className="btn-ghost" style={{ padding: '6px 8px' }}>
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => router.push('/patients')}>Patienten</span>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{patient.lastName}, {patient.firstName}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {role !== 'PATIENT' && (
            <button onClick={() => setNewAssessment(true)} className="btn-primary">
              <Plus style={{ width: 14, height: 14 }} /> Neuer Test
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px', flex: 1 }}>
        {/* ── HERO BANNER ── */}
        <div className="patient-banner" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className="avatar-xl">
                {patient.firstName[0]}{patient.lastName[0]}
                <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--surface-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera style={{ width: 10, height: 10, stroke: '#fff', fill: 'none' }} />
                </div>
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px', lineHeight: 1.2 }}>
                {patient.lastName}, {patient.firstName}
                {isClinical && (
                  <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '0.5px solid rgba(239,68,68,0.4)', verticalAlign: 'middle' }}>
                    <AlertCircle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    klinisch auffaellig
                  </span>
                )}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <span>{GENDER_LABEL[patient.gender] ?? patient.gender}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{age} Jahre</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>geb. {fmtDate(patient.dob)}</span>
                {patient.therapists?.[0]?.user && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{patient.therapists[0].user.name}</span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', fontSize: 11, border: '0.5px solid rgba(255,255,255,0.2)' }}>
                  {patient.active ? 'Aktiv' : 'Inaktiv'}
                </span>
                {patient.patientUser?.pin && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.3)', color: 'rgba(199,210,254,1)', fontSize: 11, border: '0.5px solid rgba(99,102,241,0.4)', fontFamily: 'monospace', letterSpacing: 2 }}>
                    PIN {patient.patientUser.pin}
                  </span>
                )}
              </div>
            </div>

            {/* Score Box */}
            {gsiT && (
              <div style={{ flexShrink: 0, textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 20px', border: '0.5px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: gsiT >= 60 ? '#fca5a5' : '#86efac', lineHeight: 1 }}>T={gsiT}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>GSI aktuell</div>
              </div>
            )}
          </div>

          {/* KPI Row */}
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
            {[
              { label: 'Tests gesamt', value: patient.assessments?.length ?? 0 },
              { label: 'Letzte GSI', value: gsiT ? 'T=' + gsiT : '—' },
              { label: 'Verlaufsnotizen', value: patient.sessionNotes?.length ?? notes?.length ?? 0 },
              { label: 'Termine', value: '—' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', gap: 2, padding: 4, background: 'var(--surface-card)', border: '0.5px solid var(--border)', borderRadius: 12, marginBottom: 16, overflowX: 'auto' }}>
          {TABS.map(t => {
            const cnt = t.count ? t.count(patient) : null
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('tab-item', tab === t.key && 'active')}
                style={{ border: 'none', cursor: 'pointer' }}>
                <t.icon style={{ width: 13, height: 13 }} />
                {t.label}
                {cnt !== null && cnt > 0 && <span className="tab-count">{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* ── STAMMDATEN ── */}
        {tab === 'stammdaten' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Persönliche Daten */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Persönliche Daten</h2>
              </div>
              {[
                ['Vorname', patient.firstName],
                ['Nachname', patient.lastName],
                ['Geburtsdatum', fmtDate(patient.dob)],
                ['Alter', age + ' Jahre'],
                ['Geschlecht', GENDER_LABEL[patient.gender] ?? patient.gender],
                ['Telefon', patient.phone ?? '—'],
                ['E-Mail', patient.email ?? '—'],
              ].map(([l, v]) => (
                <div key={l} className="field-row">
                  <span className="field-label">{l}</span>
                  <span className="field-value">{v}</span>
                </div>
              ))}
            </div>

            {/* Administrative Daten */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Administrative Daten</h2>
              </div>
              {[
                ['Versicherungsträger', patient.insuranceProvider ?? '—'],
                ['Zuweisung durch', patient.referralSource ?? '—'],
                ['Behandler', patient.therapists?.[0]?.user?.name ?? '—'],
                ['Patient seit', fmtDate(patient.createdAt)],
                ['PIN-Login', patient.patientUser?.pin ?? '—'],
                ['Status', patient.active ? 'Aktiv' : 'Inaktiv'],
              ].map(([l, v]) => (
                <div key={l} className="field-row">
                  <span className="field-label">{l}</span>
                  <span className="field-value" style={l === 'PIN-Login' ? { fontFamily: 'monospace', background: 'var(--surface-panel)', padding: '2px 8px', borderRadius: 5, fontSize: 12 } : {}}>
                    {l === 'Status' ? <span className={v === 'Aktiv' ? 'badge badge-green' : 'badge badge-gray'}>{v}</span> : v}
                  </span>
                </div>
              ))}

              {/* Foto Upload */}
              <div style={{ marginTop: 14, border: '1.5px dashed var(--border-strong)', borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as any).style.background = 'var(--surface-hover)'}
                onMouseLeave={e => (e.currentTarget as any).style.background = ''}>
                <Camera style={{ width: 20, height: 20, color: 'var(--text-muted)', margin: '0 auto 6px' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patientenfoto hochladen</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, opacity: 0.7 }}>JPG, PNG bis 5 MB</div>
              </div>
            </div>
          </div>
        )}

        {/* ── SCREENING ── */}
        {tab === 'screening' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>SCL-90-S Tests</h2>
              <button onClick={() => setNewAssessment(true)} className="btn-primary">
                <Plus style={{ width: 13, height: 13 }} /> Neuer Test
              </button>
            </div>
            {patient.assessments?.length === 0 ? (
              <div className="empty-state">
                <Activity style={{ width: 36, height: 36 }} className="empty-state-icon" />
                <p className="empty-state-text">Noch keine Tests vorhanden.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr>
                  <th>Anlass</th><th>Status</th><th>Datum</th><th>GSI</th><th>T-Score</th><th></th>
                </tr></thead>
                <tbody>
                  {patient.assessments?.map((a: any) => {
                    const gsi = a.result?.scores?.GSI
                    return (
                      <tr key={a.id} onClick={() => router.push(a.status === 'IN_PROGRESS' ? '/assessment/' + a.id : '/session/' + a.sessionId + '/results')}>
                        <td className="primary">{a.session?.occasion || '—'}</td>
                        <td><span className={a.status === 'SCORED' ? 'badge badge-green' : a.status === 'IN_PROGRESS' ? 'badge badge-blue' : 'badge badge-gray'}>{a.status}</span></td>
                        <td>{fmtDate(a.createdAt)}</td>
                        <td>{gsi ? gsi.raw?.toFixed(2) : '—'}</td>
                        <td>{gsi ? 'T=' + gsi.tScore : '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>›</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── THERAPIEPLAN (placeholder) ── */}
        {tab === 'therapieplan' && (
          <div className="card" style={{ padding: 24 }}>
            <div className="empty-state">
              <ClipboardList style={{ width: 36, height: 36 }} className="empty-state-icon" />
              <p className="empty-state-text">Therapieplan wird implementiert.</p>
            </div>
          </div>
        )}

        {/* ── DIAGNOSEN (placeholder) ── */}
        {tab === 'diagnosen' && (
          <div className="card" style={{ padding: 24 }}>
            <div className="empty-state">
              <FileText style={{ width: 36, height: 36 }} className="empty-state-icon" />
              <p className="empty-state-text">ICD-10 Diagnosen werden implementiert.</p>
            </div>
          </div>
        )}

        {/* ── DOKUMENTE (placeholder) ── */}
        {tab === 'dokumente' && (
          <div className="card" style={{ padding: 24 }}>
            <div className="empty-state">
              <FileText style={{ width: 36, height: 36 }} className="empty-state-icon" />
              <p className="empty-state-text">Dokumentenverwaltung wird implementiert.</p>
            </div>
          </div>
        )}

        {/* ── TERMINE (placeholder) ── */}
        {tab === 'termine' && (
          <div className="card" style={{ padding: 24 }}>
            <div className="empty-state">
              <Calendar style={{ width: 36, height: 36 }} className="empty-state-icon" />
              <p className="empty-state-text">Termine werden hier angezeigt.</p>
            </div>
          </div>
        )}

        {/* ── VERLAUF ── */}
        {tab === 'verlauf' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Verlaufsnotizen</h2>
              <button onClick={() => setNewNote(true)} className="btn-primary">
                <Plus style={{ width: 13, height: 13 }} /> Neue Notiz
              </button>
            </div>
            {(!notes || notes.length === 0) ? (
              <div className="empty-state">
                <MessageSquare style={{ width: 36, height: 36 }} className="empty-state-icon" />
                <p className="empty-state-text">Noch keine Verlaufsnotizen.</p>
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map((n: any) => (
                  <div key={n.id} style={{ padding: 14, background: 'var(--surface-panel)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="badge badge-indigo">{n.noteType}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(n.date)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{n.author?.name}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {newNote && (
        <div className="modal-overlay" onClick={() => setNewNote(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>Neue Verlaufsnotiz</h2>
              <button onClick={() => setNewNote(false)} className="btn-ghost" style={{ padding: '4px' }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-grid-2">
                <div><label className="label">Datum</label><input type="date" className="input" value={noteForm.date} onChange={e => setNoteForm(f => ({...f, date: e.target.value}))} /></div>
                <div><label className="label">Typ</label>
                  <select className="input" value={noteForm.noteType} onChange={e => setNoteForm(f => ({...f, noteType: e.target.value}))}>
                    <option value="PROGRESS">Verlaufsnotiz</option>
                    <option value="ANAMNESIS">Anamnese</option>
                    <option value="GOAL">Therapieziel</option>
                    <option value="INTERVENTION">Intervention</option>
                    <option value="OTHER">Sonstiges</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Inhalt</label>
                <textarea className="input" rows={5} placeholder="Notiz eingeben..." value={noteForm.content} onChange={e => setNoteForm(f => ({...f, content: e.target.value}))} style={{ resize: 'vertical', lineHeight: 1.6 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setNewNote(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={addNote} disabled={savingNote || !noteForm.content} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingNote ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {newAssessment && (
        <div className="modal-overlay" onClick={() => setNewAssessment(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>Neuer Test</h2>
              <button onClick={() => setNewAssessment(false)} className="btn-ghost" style={{ padding: '4px' }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Instrument</label>
                <select className="input" value={assessForm.instrumentId} onChange={e => setAssessForm(f => ({...f, instrumentId: e.target.value}))}>
                  {instruments.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div><label className="label">Anlass</label>
                <input className="input" placeholder="z.B. Ersterhebung, Verlauf Monat 3" value={assessForm.occasion} onChange={e => setAssessForm(f => ({...f, occasion: e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setNewAssessment(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={addAssessment} disabled={savingAssessment || !assessForm.instrumentId} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingAssessment ? 'Starte...' : 'Test starten'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
