
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, FileText, ClipboardList, MessageSquare, ChevronLeft, Plus,
  AlertCircle, Camera, Calendar, Activity, X, Trash2, Edit3, Check,
  Upload, Download, Eye, Search, ChevronDown, Target, CheckCircle,
  Clock, XCircle, Flag, Stethoscope
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchICD10 } from '@/lib/icd10/codes'
import { SessionsBillingPanel } from './SessionsBillingPanel'
import { PatientStatsPanel } from './PatientStatsPanel'

type Tab = 'stammdaten' | 'screening' | 'sessions' | 'anamnese' | 'therapieplan' | 'diagnosen' | 'dokumente' | 'medikamente' | 'termine' | 'verlauf' | 'statistik'

const GENDER_LABEL: Record<string,string> = { MALE: 'maennlich', FEMALE: 'weiblich', DIVERSE: 'divers' }

const DOC_CATEGORY_LABEL: Record<string,string> = {
  REFERRAL: 'Zuweisung', REPORT: 'Befund', CERTIFICATE: 'Attest',
  THERAPY_REPORT: 'Therapiebericht', INSURANCE: 'Versicherung',
  CONSENT: 'Einverstaendnis', OTHER: 'Sonstiges',
}

const GOAL_STATUS_LABEL: Record<string,string> = {
  OPEN: 'Offen', IN_PROGRESS: 'In Bearbeitung', ACHIEVED: 'Erreicht', ABANDONED: 'Abgebrochen',
}
const GOAL_STATUS_CLASS: Record<string,string> = {
  OPEN: 'badge-blue', IN_PROGRESS: 'badge-amber', ACHIEVED: 'badge-green', ABANDONED: 'badge-gray',
}
const DIAG_TYPE_LABEL: Record<string,string> = {
  PRIMARY: 'Hauptdiagnose', SECONDARY: 'Nebendiagnose', EXCLUSION: 'Ausschluss',
}

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
function fmtBytes(b: number) {
  if (b < 1024) return b + ' B'
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB'
  return (b/1024/1024).toFixed(1) + ' MB'
}

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'stammdaten',   label: 'Stammdaten',   icon: User },
  { key: 'sessions',     label: 'Sitzungen',      icon: ClipboardList },
  { key: 'screening',    label: 'Screening',     icon: Activity },
  { key: 'anamnese',     label: 'Anamnese',      icon: FileText },
  { key: 'therapieplan', label: 'Therapieplan',  icon: Target },
  { key: 'diagnosen',    label: 'Diagnosen',     icon: Stethoscope },
  { key: 'medikamente',  label: 'Medikamente',   icon: Activity },
  { key: 'dokumente',    label: 'Dokumente',     icon: FileText },
  { key: 'termine',      label: 'Termine',       icon: Calendar },
  { key: 'verlauf',      label: 'Verlauf',       icon: MessageSquare },
]

export function PatientRecordClient({ patient, notes, instruments, currentUserId, role }: any) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('stammdaten')

  // Photo
  const [photoSrc, setPhotoSrc] = useState<string|null>(null)
  useEffect(() => {
    fetch(`/api/patients/${patient.id}/photo`).then(r=>r.json()).then(d => {
      if (d?.data) setPhotoSrc(`data:${d.mimeType};base64,${d.data}`)
    }).catch(()=>{})
  }, [patient.id])

  // Documents
  const [docs, setDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docForm, setDocForm] = useState({ name: '', category: 'OTHER', note: '' })
  const [showDocUpload, setShowDocUpload] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<any>(null)

  const loadDocs = useCallback(() => {
    setDocsLoading(true)
    fetch(`/api/patients/${patient.id}/documents`).then(r=>r.json()).then(d=>{setDocs(d);setDocsLoading(false)}).catch(()=>setDocsLoading(false))
  }, [patient.id])
  useEffect(() => { if (tab==='dokumente') loadDocs() }, [tab, loadDocs])

  // Goals
  const [goals, setGoals] = useState<any[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', priority: 2, targetDate: '', status: 'OPEN' })
  const [savingGoal, setSavingGoal] = useState(false)

  const loadGoals = useCallback(() => {
    setGoalsLoading(true)
    fetch(`/api/patients/${patient.id}/goals`).then(r=>r.json()).then(d=>{setGoals(d);setGoalsLoading(false)}).catch(()=>setGoalsLoading(false))
  }, [patient.id])
  useEffect(() => { if (tab==='therapieplan') loadGoals() }, [tab, loadGoals])

  // Diagnoses
  const [diags, setDiags] = useState<any[]>([])
  const [diagsLoading, setDiagsLoading] = useState(false)
  const [showDiagForm, setShowDiagForm] = useState(false)
  const [diagSearch, setDiagSearch] = useState('')
  const [diagResults, setDiagResults] = useState<any[]>([])
  const [selectedCode, setSelectedCode] = useState<any>(null)
  const [diagForm, setDiagForm] = useState({ diagnosisType: 'PRIMARY', certainty: 'gesichert', note: '' })
  const [savingDiag, setSavingDiag] = useState(false)

  const loadDiags = useCallback(() => {
    setDiagsLoading(true)
    fetch(`/api/patients/${patient.id}/diagnoses`).then(r=>r.json()).then(d=>{setDiags(d);setDiagsLoading(false)}).catch(()=>setDiagsLoading(false))
  }, [patient.id])
  useEffect(() => { if (tab==='diagnosen') loadDiags() }, [tab, loadDiags])

  // Notes
  const [noteForm, setNoteForm] = useState({ date: new Date().toISOString().slice(0,10), noteType: 'PROGRESS', content: '' })
  const [newNote, setNewNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  // Assessment
  const [assessForm, setAssessForm] = useState({ instrumentId: instruments[0]?.id ?? '', occasion: '' })
  const [newAssessment, setNewAssessment] = useState(false)
  const [savingAssessment, setSavingAssessment] = useState(false)

  const age = calcAge(patient.dob)
  const latestScored = patient.assessments?.find((a: any) => a.status === 'SCORED' || a.status === 'LOCKED')
  const latestScores = latestScored?.result?.scores as any
  const isClinical = latestScored?.result?.isClinicalCase
  const gsiT = latestScores?.GSI?.tScore

  // Photo upload
  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const result = ev.target?.result as string
      const [header, base64] = result.split(',')
      const mimeType = header.match(/data:(.+);/)?.[1] ?? 'image/jpeg'
      await fetch(`/api/patients/${patient.id}/photo`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ base64, mimeType }),
      })
      setPhotoSrc(`data:${mimeType};base64,${base64}`)
    }
    reader.readAsDataURL(file)
  }

  // Document upload
  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !docForm.name) return
    setUploadingDoc(true)
    const reader = new FileReader()
    reader.onload = async ev => {
      const result = ev.target?.result as string
      const [, base64] = result.split(',')
      await fetch(`/api/patients/${patient.id}/documents`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...docForm, base64, mimeType: file.type, size: file.size }),
      })
      setUploadingDoc(false); setShowDocUpload(false)
      setDocForm({ name: '', category: 'OTHER', note: '' }); loadDocs()
    }
    reader.readAsDataURL(file)
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Dokument löschen?')) return
    await fetch(`/api/patients/${patient.id}/documents/${docId}`, { method: 'DELETE' })
    loadDocs()
  }

  async function viewDoc(docId: string) {
    const res = await fetch(`/api/patients/${patient.id}/documents/${docId}`)
    const data = await res.json()
    setPreviewDoc(data)
  }

  // Goals
  async function saveGoal() {
    setSavingGoal(true)
    await fetch(`/api/patients/${patient.id}/goals`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(goalForm),
    })
    setSavingGoal(false); setShowGoalForm(false)
    setGoalForm({ title: '', description: '', priority: 2, targetDate: '', status: 'OPEN' }); loadGoals()
  }

  async function updateGoalStatus(goalId: string, status: string) {
    await fetch(`/api/patients/${patient.id}/goals/${goalId}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status, ...(status==='ACHIEVED' ? { achievedAt: new Date().toISOString() } : {}) }),
    })
    loadGoals()
  }

  async function deleteGoal(goalId: string) {
    if (!confirm('Ziel löschen?')) return
    await fetch(`/api/patients/${patient.id}/goals/${goalId}`, { method: 'DELETE' })
    loadGoals()
  }

  // Diagnoses
  useEffect(() => {
    if (diagSearch.length >= 2) setDiagResults(searchICD10(diagSearch, 8))
    else setDiagResults([])
  }, [diagSearch])

  async function saveDiag() {
    if (!selectedCode) return
    setSavingDiag(true)
    await fetch(`/api/patients/${patient.id}/diagnoses`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ ...diagForm, icdCode: selectedCode.code, icdLabel: selectedCode.label }),
    })
    setSavingDiag(false); setShowDiagForm(false)
    setSelectedCode(null); setDiagSearch(''); loadDiags()
  }

  async function deleteDiag(diagId: string) {
    if (!confirm('Diagnose löschen?')) return
    await fetch(`/api/patients/${patient.id}/diagnoses/${diagId}`, { method: 'DELETE' })
    loadDiags()
  }

  // Notes
  async function addNote() {
    setSavingNote(true)
    await fetch(`/api/patients/${patient.id}/notes`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(noteForm),
    })
    setSavingNote(false); setNewNote(false); router.refresh()
  }

  // Assessment
  async function addAssessment() {
    setSavingAssessment(true)
    const res = await fetch('/api/assessments', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ patientId: patient.id, ...assessForm }),
    })
    const data = await res.json()
    setSavingAssessment(false); setNewAssessment(false)
    if (data.id) router.push('/assessment/' + data.id)
  }

  const tabCounts: Partial<Record<Tab,number>> = {
    screening: patient.assessments?.length ?? 0,
    therapieplan: goals.length,
    diagnosen: diags.length,
    dokumente: docs.length,
    verlauf: notes?.length ?? 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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

      <div style={{ padding: 20, flex: 1 }}>
        {/* ── HERO BANNER ── */}
        <div className="patient-banner" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            {/* Photo/Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photoSrc ? (
                <img src={photoSrc} alt="Foto" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 14, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {patient.firstName[0]}{patient.lastName[0]}
                </div>
              )}
              <button onClick={() => photoRef.current?.click()}
                style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--surface-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera style={{ width: 10, height: 10, stroke: '#fff', fill: 'none' }} />
              </button>
              <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {patient.lastName}, {patient.firstName}
                {isClinical && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '0.5px solid rgba(239,68,68,0.4)' }}>
                    <AlertCircle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    klinisch auffaellig
                  </span>
                )}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <span>{GENDER_LABEL[patient.gender] ?? patient.gender}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{age} Jahre · geb. {fmtDate(patient.dob)}</span>
                {patient.therapists?.[0]?.user && <><span style={{ opacity: 0.4 }}>·</span><span>{patient.therapists[0].user.name}</span></>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', fontSize: 11, border: '0.5px solid rgba(255,255,255,0.2)' }}>
                  {patient.active ? 'Aktiv' : 'Inaktiv'}
                </span>
                {patient.patientUser?.pin && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.3)', color: '#c7d2fe', fontSize: 11, border: '0.5px solid rgba(99,102,241,0.4)', fontFamily: 'monospace', letterSpacing: 2 }}>
                    PIN {patient.patientUser.pin}
                  </span>
                )}
              </div>
            </div>

            {/* Score */}
            {gsiT && (
              <div style={{ flexShrink: 0, textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 20px', border: '0.5px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: gsiT >= 60 ? '#fca5a5' : '#86efac', lineHeight: 1 }}>T={gsiT}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>GSI aktuell</div>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
            {[
              { label: 'Tests', value: patient.assessments?.length ?? 0 },
              { label: 'Ziele', value: goals.length },
              { label: 'Diagnosen', value: diags.length },
              { label: 'Dokumente', value: docs.length },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', gap: 2, padding: 4, background: 'var(--surface-card)', border: '0.5px solid var(--border)', borderRadius: 12, marginBottom: 16, overflowX: 'auto' }}>
          {TABS.map(t => {
            const cnt = tabCounts[t.key]
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('tab-item', tab === t.key && 'active')}
                style={{ border: 'none', cursor: 'pointer', background: 'none' }}>
                <t.icon style={{ width: 13, height: 13 }} />
                {t.label}
                {cnt !== undefined && cnt > 0 && <span className="tab-count">{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* ── STAMMDATEN ── */}
        {tab === 'stammdaten' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Persönliche Daten</h3>
              {[['Vorname',patient.firstName],['Nachname',patient.lastName],['Geburtsdatum',fmtDate(patient.dob)],['Alter',age+' Jahre'],['Geschlecht',GENDER_LABEL[patient.gender]??patient.gender],['Telefon',patient.phone??'—'],['E-Mail',patient.email??'—']].map(([l,v]) => (
                <div key={l} className="field-row"><span className="field-label">{l}</span><span className="field-value">{v}</span></div>
              ))}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Administrative Daten</h3>
              {[['Versicherungsträger',patient.insuranceProvider??'—'],['Zuweisung',patient.referralSource??'—'],['Behandler',patient.therapists?.[0]?.user?.name??'—'],['Patient seit',fmtDate(patient.createdAt)],['Status',patient.active?'Aktiv':'Inaktiv']].map(([l,v]) => (
                <div key={l} className="field-row">
                  <span className="field-label">{l}</span>
                  <span className="field-value">{l==='Status'?<span className={patient.active?'badge badge-green':'badge badge-gray'}>{v}</span>:v}</span>
                </div>
              ))}
              {patient.patientUser?.pin && (
                <div className="field-row">
                  <span className="field-label">PIN-Login</span>
                  <span style={{ fontFamily: 'monospace', background: 'var(--surface-panel)', padding: '2px 8px', borderRadius: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{patient.patientUser.pin}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SESSIONS ── */}
        {tab === 'sessions' && (
          <SessionsBillingPanel patientId={patient.id} role={role} />
        )}

        {/* ── SCREENING ── */}
        {tab === 'screening' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>SCL-90-S Tests</h2>
              <button onClick={() => setNewAssessment(true)} className="btn-primary"><Plus style={{ width: 13, height: 13 }} /> Neuer Test</button>
            </div>
            {!patient.assessments?.length ? (
              <div className="empty-state"><Activity className="empty-state-icon" style={{ width: 36, height: 36 }} /><p className="empty-state-text">Noch keine Tests vorhanden.</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Anlass</th><th>Status</th><th>Datum</th><th>GSI</th><th>T-Score</th><th></th></tr></thead>
                <tbody>
                  {patient.assessments?.map((a: any) => {
                    const gsi = a.result?.scores?.GSI
                    return (
                      <tr key={a.id} onClick={() => router.push(a.status==='IN_PROGRESS'?'/assessment/'+a.id:'/assessment/'+a.id+'/results')}>
                        <td className="primary">{a.session?.occasion||'—'}</td>
                        <td><span className={a.status==='SCORED'?'badge badge-green':a.status==='IN_PROGRESS'?'badge badge-blue':'badge badge-gray'}>{a.status}</span></td>
                        <td>{fmtDate(a.createdAt)}</td>
                        <td>{gsi?gsi.raw?.toFixed(2):'—'}</td>
                        <td>{gsi?'T='+gsi.tScore:'—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>›</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── THERAPIEPLAN ── */}
        {tab === 'therapieplan' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Therapieziele</h2>
              <button onClick={() => setShowGoalForm(true)} className="btn-primary"><Plus style={{ width: 13, height: 13 }} /> Neues Ziel</button>
            </div>
            {goalsLoading ? <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div> :
            goals.length === 0 ? (
              <div className="card" style={{ padding: 24 }}>
                <div className="empty-state"><Target className="empty-state-icon" style={{ width: 36, height: 36 }} /><p className="empty-state-text">Noch keine Therapieziele definiert.</p></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {goals.map(g => (
                  <div key={g.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{g.title}</span>
                          <span className={cn('badge', GOAL_STATUS_CLASS[g.status])}>{GOAL_STATUS_LABEL[g.status]}</span>
                          <span className="badge badge-gray">P{g.priority}</span>
                        </div>
                        {g.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{g.description}</p>}
                        {g.targetDate && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Zieldatum: {fmtDate(g.targetDate)}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {g.status !== 'ACHIEVED' && (
                          <button onClick={() => updateGoalStatus(g.id, 'ACHIEVED')} className="btn-secondary" style={{ padding: '4px 8px' }} title="Als erreicht markieren">
                            <CheckCircle style={{ width: 13, height: 13, color: 'var(--green)' }} />
                          </button>
                        )}
                        {g.status === 'OPEN' && (
                          <button onClick={() => updateGoalStatus(g.id, 'IN_PROGRESS')} className="btn-secondary" style={{ padding: '4px 8px' }} title="In Bearbeitung">
                            <Clock style={{ width: 13, height: 13, color: 'var(--amber)' }} />
                          </button>
                        )}
                        <button onClick={() => deleteGoal(g.id)} className="btn-danger" style={{ padding: '4px 8px' }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DIAGNOSEN ── */}
        {tab === 'diagnosen' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>ICD-10 Diagnosen</h2>
              <button onClick={() => setShowDiagForm(true)} className="btn-primary"><Plus style={{ width: 13, height: 13 }} /> Diagnose hinzufügen</button>
            </div>
            {diagsLoading ? <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div> :
            diags.length === 0 ? (
              <div className="card" style={{ padding: 24 }}>
                <div className="empty-state"><Stethoscope className="empty-state-icon" style={{ width: 36, height: 36 }} /><p className="empty-state-text">Noch keine Diagnosen erfasst.</p></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {diags.map(d => (
                  <div key={d.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ padding: '6px 10px', background: 'var(--color-primary-light)', borderRadius: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace' }}>{d.icdCode}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{d.icdLabel}</span>
                          <span className="badge badge-indigo">{DIAG_TYPE_LABEL[d.diagnosisType]}</span>
                          {d.certainty && <span className="badge badge-gray">{d.certainty}</span>}
                        </div>
                        {d.note && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{d.note}</p>}
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>{fmtDate(d.diagnosedAt)}</p>
                      </div>
                      <button onClick={() => deleteDiag(d.id)} className="btn-danger" style={{ padding: '4px 8px' }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DOKUMENTE ── */}
        {tab === 'dokumente' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Dokumente</h2>
              <button onClick={() => setShowDocUpload(true)} className="btn-primary"><Upload style={{ width: 13, height: 13 }} /> Dokument hochladen</button>
            </div>
            {docsLoading ? <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div> :
            docs.length === 0 ? (
              <div className="card" style={{ padding: 24 }}>
                <div className="empty-state"><FileText className="empty-state-icon" style={{ width: 36, height: 36 }} /><p className="empty-state-text">Noch keine Dokumente vorhanden.</p></div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Kategorie</th><th>Größe</th><th>Datum</th><th></th></tr></thead>
                  <tbody>
                    {docs.map(d => (
                      <tr key={d.id}>
                        <td className="primary">{d.name}</td>
                        <td><span className="badge badge-indigo">{DOC_CATEGORY_LABEL[d.category]??d.category}</span></td>
                        <td>{fmtBytes(d.size)}</td>
                        <td>{fmtDate(d.uploadedAt)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => viewDoc(d.id)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                              <Eye style={{ width: 13, height: 13 }} />
                            </button>
                            <button onClick={() => deleteDoc(d.id)} className="btn-danger" style={{ padding: '4px 8px' }}>
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── STATISTIKEN ── */}
        {tab === 'statistik' && (
          <PatientStatsPanel patientId={patient.id} />
        )}

        {/* ── TERMINE ── */}
        {tab === 'termine' && (
          <div className="card" style={{ padding: 24 }}>
            <div className="empty-state"><Calendar className="empty-state-icon" style={{ width: 36, height: 36 }} /><p className="empty-state-text">Termine werden hier angezeigt.</p></div>
          </div>
        )}

        {/* ── VERLAUF ── */}
        {tab === 'verlauf' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Verlaufsnotizen</h2>
              <button onClick={() => setNewNote(true)} className="btn-primary"><Plus style={{ width: 13, height: 13 }} /> Neue Notiz</button>
            </div>
            {!notes?.length ? (
              <div className="card" style={{ padding: 24 }}>
                <div className="empty-state"><MessageSquare className="empty-state-icon" style={{ width: 36, height: 36 }} /><p className="empty-state-text">Noch keine Verlaufsnotizen.</p></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map((n: any) => (
                  <div key={n.id} style={{ padding: 16, background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
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

      {/* ══ MODALS ══ */}

      {/* Neuer Test */}
      {newAssessment && (
        <div className="modal-overlay" onClick={() => setNewAssessment(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 style={{ margin: 0, fontSize: 15 }}>Neuer Test</h2><button onClick={() => setNewAssessment(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Instrument</label>
                <select className="input" value={assessForm.instrumentId} onChange={e => setAssessForm(f=>({...f,instrumentId:e.target.value}))}>
                  {instruments.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div><label className="label">Anlass</label>
                <input className="input" placeholder="z.B. Ersterhebung" value={assessForm.occasion} onChange={e => setAssessForm(f=>({...f,occasion:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setNewAssessment(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={addAssessment} disabled={savingAssessment||!assessForm.instrumentId} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingAssessment ? 'Starte...' : 'Test starten'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Neue Notiz */}
      {newNote && (
        <div className="modal-overlay" onClick={() => setNewNote(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 style={{ margin: 0, fontSize: 15 }}>Neue Verlaufsnotiz</h2><button onClick={() => setNewNote(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-grid-2">
                <div><label className="label">Datum</label><input type="date" className="input" value={noteForm.date} onChange={e => setNoteForm(f=>({...f,date:e.target.value}))} /></div>
                <div><label className="label">Typ</label>
                  <select className="input" value={noteForm.noteType} onChange={e => setNoteForm(f=>({...f,noteType:e.target.value}))}>
                    <option value="PROGRESS">Verlaufsnotiz</option><option value="ANAMNESIS">Anamnese</option>
                    <option value="GOAL">Therapieziel</option><option value="INTERVENTION">Intervention</option><option value="OTHER">Sonstiges</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Inhalt</label>
                <textarea className="input" rows={5} value={noteForm.content} onChange={e => setNoteForm(f=>({...f,content:e.target.value}))} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setNewNote(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={addNote} disabled={savingNote||!noteForm.content} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingNote ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Therapieziel */}
      {showGoalForm && (
        <div className="modal-overlay" onClick={() => setShowGoalForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 style={{ margin: 0, fontSize: 15 }}>Neues Therapieziel</h2><button onClick={() => setShowGoalForm(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Ziel *</label><input className="input" placeholder="z.B. Reduktion von Angstsymptomen" value={goalForm.title} onChange={e => setGoalForm(f=>({...f,title:e.target.value}))} /></div>
              <div><label className="label">Beschreibung</label><textarea className="input" rows={3} value={goalForm.description} onChange={e => setGoalForm(f=>({...f,description:e.target.value}))} style={{ resize: 'vertical' }} /></div>
              <div className="form-grid-2">
                <div><label className="label">Priorität</label>
                  <select className="input" value={goalForm.priority} onChange={e => setGoalForm(f=>({...f,priority:+e.target.value}))}>
                    <option value={1}>1 – Hoch</option><option value={2}>2 – Mittel</option><option value={3}>3 – Niedrig</option>
                  </select>
                </div>
                <div><label className="label">Zieldatum</label><input type="date" className="input" value={goalForm.targetDate} onChange={e => setGoalForm(f=>({...f,targetDate:e.target.value}))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowGoalForm(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={saveGoal} disabled={savingGoal||!goalForm.title} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingGoal ? 'Speichern...' : 'Ziel speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnose */}
      {showDiagForm && (
        <div className="modal-overlay" onClick={() => setShowDiagForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header"><h2 style={{ margin: 0, fontSize: 15 }}>ICD-10 Diagnose</h2><button onClick={() => setShowDiagForm(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* ICD Search */}
              <div>
                <label className="label">ICD-10 Code suchen *</label>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                  <input className="input" style={{ paddingLeft: 32 }} placeholder="z.B. F32 oder Depression..." value={diagSearch} onChange={e => setDiagSearch(e.target.value)} />
                </div>
                {diagResults.length > 0 && (
                  <div style={{ marginTop: 4, border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-card)' }}>
                    {diagResults.map(r => (
                      <div key={r.code} onClick={() => { setSelectedCode(r); setDiagSearch(r.code + ' – ' + r.label); setDiagResults([]) }}
                        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '0.5px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget as any).style.background='var(--surface-hover)'}
                        onMouseLeave={e => (e.currentTarget as any).style.background=''}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', minWidth: 50 }}>{r.code}</span>
                        <div>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.label}</span>
                          {r.definition && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>{r.definition}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedCode && (
                  <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--color-primary-light)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>{selectedCode.code}</span>
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedCode.label}</span>
                      {selectedCode.definition && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{selectedCode.definition}</p>}
                    </div>
                    <button onClick={() => { setSelectedCode(null); setDiagSearch('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X style={{ width: 13, height: 13 }} /></button>
                  </div>
                )}
              </div>
              <div className="form-grid-2">
                <div><label className="label">Diagnosetyp</label>
                  <select className="input" value={diagForm.diagnosisType} onChange={e => setDiagForm(f=>({...f,diagnosisType:e.target.value}))}>
                    <option value="PRIMARY">Hauptdiagnose</option><option value="SECONDARY">Nebendiagnose</option><option value="EXCLUSION">Ausschluss</option>
                  </select>
                </div>
                <div><label className="label">Sicherheit</label>
                  <select className="input" value={diagForm.certainty} onChange={e => setDiagForm(f=>({...f,certainty:e.target.value}))}>
                    <option value="gesichert">gesichert</option><option value="Verdacht">Verdacht</option><option value="Ausschluss">Ausschluss</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Notiz</label><input className="input" placeholder="Optionale Anmerkung..." value={diagForm.note} onChange={e => setDiagForm(f=>({...f,note:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDiagForm(false)} className="btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={saveDiag} disabled={savingDiag||!selectedCode} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {savingDiag ? 'Speichern...' : 'Diagnose speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dokument Upload */}
      {showDocUpload && (
        <div className="modal-overlay" onClick={() => setShowDocUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 style={{ margin: 0, fontSize: 15 }}>Dokument hochladen</h2><button onClick={() => setShowDocUpload(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Bezeichnung *</label><input className="input" placeholder="z.B. Zuweisung Dr. Muster" value={docForm.name} onChange={e => setDocForm(f=>({...f,name:e.target.value}))} /></div>
              <div><label className="label">Kategorie</label>
                <select className="input" value={docForm.category} onChange={e => setDocForm(f=>({...f,category:e.target.value}))}>
                  {Object.entries(DOC_CATEGORY_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Notiz</label><input className="input" placeholder="Optionale Anmerkung..." value={docForm.note} onChange={e => setDocForm(f=>({...f,note:e.target.value}))} /></div>
              <div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={uploadDoc} />
                <button onClick={() => { if (!docForm.name) { alert('Bitte zuerst eine Bezeichnung eingeben.'); return } fileRef.current?.click() }}
                  disabled={uploadingDoc||!docForm.name} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Upload style={{ width: 14, height: 14 }} />
                  {uploadingDoc ? 'Hochladen...' : 'Datei auswählen und hochladen'}
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDocUpload(false)} className="btn-secondary" style={{ flex: 1 }}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Dokument Vorschau */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal" style={{ maxWidth: 800, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>{previewDoc.name}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`data:${previewDoc.mimeType};base64,${previewDoc.data}`} download={previewDoc.name} className="btn-secondary" style={{ textDecoration: 'none' }}>
                  <Download style={{ width: 13, height: 13 }} /> Download
                </a>
                <button onClick={() => setPreviewDoc(null)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
              </div>
            </div>
            <div style={{ padding: 16, maxHeight: '70vh', overflow: 'auto' }}>
              {previewDoc.mimeType?.startsWith('image/') && (
                <img src={`data:${previewDoc.mimeType};base64,${previewDoc.data}`} alt={previewDoc.name} style={{ maxWidth: '100%', borderRadius: 8 }} />
              )}
              {previewDoc.mimeType === 'application/pdf' && (
                <iframe src={`data:application/pdf;base64,${previewDoc.data}`} style={{ width: '100%', height: 500, border: 'none', borderRadius: 8 }} />
              )}
              {!previewDoc.mimeType?.startsWith('image/') && previewDoc.mimeType !== 'application/pdf' && (
                <div className="empty-state">
                  <FileText className="empty-state-icon" style={{ width: 36, height: 36 }} />
                  <p className="empty-state-text">Vorschau nicht verfügbar.</p>
                  <a href={`data:${previewDoc.mimeType};base64,${previewDoc.data}`} download={previewDoc.name} className="btn-primary" style={{ marginTop: 12, textDecoration: 'none' }}>
                    <Download style={{ width: 14, height: 14 }} /> Herunterladen
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
