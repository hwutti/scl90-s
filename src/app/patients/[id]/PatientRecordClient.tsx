'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, FileText, ClipboardList, MessageSquare, ChevronLeft,
  Plus, Download, AlertCircle, CheckCircle, Clock, Edit3, Save, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'stammdaten' | 'anamnese' | 'tests' | 'notizen'

const GENDER_LABEL: Record<string, string> = { MALE: 'männlich', FEMALE: 'weiblich', DIVERSE: 'divers' }
const NOTE_TYPE_LABEL: Record<string, string> = {
  PROGRESS: 'Verlaufsnotiz', ANAMNESIS: 'Anamnese',
  GOAL: 'Therapieziel', INTERVENTION: 'Intervention', OTHER: 'Sonstiges',
}
const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Zugewiesen', IN_PROGRESS: 'Läuft', COMPLETED: 'Abgeschlossen',
  SCORED: 'Ausgewertet', LOCKED: 'Gesperrt',
}

function calcAge(dob: string) {
  const d = new Date(dob + 'T00:00:00')
  let age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--
  return age
}

function formatDate(s: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(s))
}

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
  const [newNote, setNewNote] = useState(false)
  const [noteForm, setNoteForm] = useState({ date: new Date().toISOString().slice(0,10), noteType: 'PROGRESS', content: '' })
  const [savingNote, setSavingNote] = useState(false)
  const [newAssessment, setNewAssessment] = useState(false)
  const [assessForm, setAssessForm] = useState({ instrumentId: instruments[0]?.id ?? '', occasion: '' })
  const [savingAssessment, setSavingAssessment] = useState(false)

  const patientName = `${patient.firstName} ${patient.lastName}`
  const age = calcAge(patient.dob)
  const latestScored = patient.assessments.find((a: any) => a.status === 'SCORED' || a.status === 'LOCKED')
  const latestScores = latestScored?.result?.scores as any
  const isClinical = latestScored?.result?.isClinicalCase

  async function saveRecord() {
    setSavingRecord(true)
    await fetch(`/api/patients/${patient.id}/record`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordForm),
    })
    setSavingRecord(false)
    setEditRecord(false)
    router.refresh()
  }

  async function addNote() {
    setSavingNote(true)
    await fetch(`/api/patients/${patient.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteForm),
    })
    setSavingNote(false)
    setNewNote(false)
    setNoteForm({ date: new Date().toISOString().slice(0,10), noteType: 'PROGRESS', content: '' })
    router.refresh()
  }

  async function startAssessment() {
    setSavingAssessment(true)
    const res = await fetch(`/api/patients/${patient.id}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessForm),
    })
    const data = await res.json()
    setSavingAssessment(false)
    setNewAssessment(false)
    if (data.id) router.push(`/assessment/${data.id}`)
  }

  const tabs = [
    { id: 'stammdaten', label: 'Stammdaten', icon: User },
    { id: 'anamnese',   label: 'Anamnese & Diagnose', icon: FileText },
    { id: 'tests',      label: `Tests (${patient.assessments.length})`, icon: ClipboardList },
    { id: 'notizen',    label: `Verlaufsnotizen (${notes.length})`, icon: MessageSquare },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/patients')} className="btn-secondary p-2">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{patientName}</h1>
            {isClinical === true && <span className="badge-red flex items-center gap-1"><AlertCircle className="w-3 h-3" /> klinisch auffällig</span>}
            {isClinical === false && <span className="badge-green flex items-center gap-1"><CheckCircle className="w-3 h-3" /> unauffällig</span>}
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {GENDER_LABEL[patient.gender]} · {age} Jahre · geb. {formatDate(patient.dob + 'T00:00:00')}
            {patient.patientUser && <span className="ml-2 text-indigo-500">· PIN: {patient.patientUser.pin}</span>}
          </p>
        </div>
        {latestScores?.gsiT && (
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-800">T={Math.round(latestScores.gsiT)}</p>
            <p className="text-xs text-slate-400">GSI aktuell</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: STAMMDATEN ── */}
      {tab === 'stammdaten' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700">Persönliche Daten</h3>
            {[
              ['Vorname', patient.firstName],
              ['Nachname', patient.lastName],
              ['Geburtsdatum', formatDate(patient.dob + 'T00:00:00')],
              ['Alter', `${age} Jahre`],
              ['Geschlecht', GENDER_LABEL[patient.gender]],
              ['Telefon', patient.phone || '—'],
              ['E-Mail', patient.email || '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-slate-400">{l}</span>
                <span className="font-medium text-slate-700">{v}</span>
              </div>
            ))}
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-slate-700">Administrative Daten</h3>
            {[
              ['Versicherungsträger', patient.insuranceProvider || '—'],
              ['Zuweisung durch', patient.referralSource || '—'],
              ['Behandler', patient.therapists.map((t: any) => t.therapist.name).join(', ') || '—'],
              ['Patient seit', formatDate(patient.createdAt)],
              ['PIN-Login', patient.patientUser ? patient.patientUser.pin : 'kein Login'],
              ['Status', patient.active ? 'Aktiv' : 'Inaktiv'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-slate-400">{l}</span>
                <span className="font-medium text-slate-700">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: ANAMNESE ── */}
      {tab === 'anamnese' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {editRecord
              ? <div className="flex gap-2">
                  <button onClick={() => setEditRecord(false)} className="btn-secondary"><X className="w-4 h-4" /> Abbrechen</button>
                  <button onClick={saveRecord} disabled={savingRecord} className="btn-primary"><Save className="w-4 h-4" /> Speichern</button>
                </div>
              : <button onClick={() => setEditRecord(true)} className="btn-secondary"><Edit3 className="w-4 h-4" /> Bearbeiten</button>
            }
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'chiefComplaint', label: 'Hauptbeschwerde' },
              { key: 'medicalHistory', label: 'Psychiatrische / medizinische Vorgeschichte' },
              { key: 'medication',     label: 'Aktuelle Medikation' },
              { key: 'allergies',      label: 'Allergien / Unverträglichkeiten' },
              { key: 'familyHistory',  label: 'Familienanamnese' },
              { key: 'socialHistory',  label: 'Soziale Anamnese' },
            ].map(({ key, label }) => (
              <div key={key} className="card p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
                {editRecord
                  ? <textarea className="input text-sm" rows={3} value={(recordForm as any)[key]}
                      onChange={e => setRecordForm(f => ({...f, [key]: e.target.value}))} />
                  : <p className="text-sm text-slate-700 whitespace-pre-wrap">{(patient.record as any)?.[key] || <span className="text-slate-300">—</span>}</p>
                }
              </div>
            ))}
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Diagnosen (ICD-10)</p>
            {(() => {
              const diagnoses: any[] = patient.record?.diagnoses ?? []
              return diagnoses.length === 0
                ? <p className="text-sm text-slate-300">Keine Diagnose eingetragen</p>
                : diagnoses.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm mb-1">
                      <span className="badge-blue font-mono">{d.code}</span>
                      <span className="text-slate-700">{d.label}</span>
                      {d.isPrimary && <span className="badge-gray text-xs">Hauptdiagnose</span>}
                      <span className="text-slate-400 text-xs ml-auto">{d.date}</span>
                    </div>
                  ))
            })()}
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Therapieziele</p>
            {editRecord
              ? <textarea className="input text-sm" rows={3} value={recordForm.therapyGoals}
                  onChange={e => setRecordForm(f => ({...f, therapyGoals: e.target.value}))} />
              : <p className="text-sm text-slate-700 whitespace-pre-wrap">{patient.record?.therapyGoals || <span className="text-slate-300">—</span>}</p>
            }
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'therapyStart',     label: 'Therapiebeginn', type: 'date' },
              { key: 'sessionFrequency', label: 'Sitzungsfrequenz', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key} className="card p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
                {editRecord
                  ? <input type={type} className="input text-sm" value={(recordForm as any)[key]}
                      onChange={e => setRecordForm(f => ({...f, [key]: e.target.value}))} />
                  : <p className="text-sm text-slate-700">{(patient.record as any)?.[key]
                      ? type === 'date' ? formatDate((patient.record as any)[key]) : (patient.record as any)[key]
                      : '—'}
                    </p>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: TESTS ── */}
      {tab === 'tests' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewAssessment(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Neuen Test anlegen
            </button>
          </div>
          {patient.assessments.length === 0 ? (
            <div className="card py-16 text-center text-slate-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Noch keine Tests vorhanden.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Instrument', 'Anlass', 'Status', 'Datum', 'GSI T', 'Klinisch', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {patient.assessments.map((a: any) => {
                    const scores = a.result?.scores as any
                    const gsiT = scores?.gsiT ? Math.round(scores.gsiT) : null
                    const isScored = a.status === 'SCORED' || a.status === 'LOCKED'
                    return (
                      <tr key={a.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => router.push(isScored ? `/assessment/${a.id}/results` : `/assessment/${a.id}`)}>
                        <td className="px-4 py-3 font-semibold text-indigo-700">{a.instrument.shortName}</td>
                        <td className="px-4 py-3 text-slate-500">{a.occasion || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                            a.status === 'SCORED' ? 'bg-emerald-50 text-emerald-700'
                            : a.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700'
                            : a.status === 'ASSIGNED' ? 'bg-slate-100 text-slate-600'
                            : 'bg-gray-100 text-gray-500')}>
                            {STATUS_LABEL[a.status] ?? a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(a.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold">{gsiT ? `T=${gsiT}` : '—'}</td>
                        <td className="px-4 py-3">
                          {a.result?.isClinicalCase === true && <span className="badge-red text-xs">auffällig</span>}
                          {a.result?.isClinicalCase === false && <span className="badge-green text-xs">unauffällig</span>}
                          {a.result === null && <span className="badge-gray text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isScored && (
                            <button
                              onClick={e => { e.stopPropagation(); fetch(`/api/assessments/${a.id}/export`, { method: 'POST' }).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = `SCL90S_${patient.lastName}_${a.createdAt.slice(0,10)}.pdf`; l.click() }) }}
                              className="btn-secondary p-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: VERLAUFSNOTIZEN ── */}
      {tab === 'notizen' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewNote(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Neue Notiz
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="card py-16 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Noch keine Verlaufsnotizen vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n: any) => (
                <div key={n.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      {NOTE_TYPE_LABEL[n.noteType] ?? n.noteType}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(n.date)}</span>
                    <span className="text-xs text-slate-400 ml-auto">{n.author?.name}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Neue Notiz */}
      {newNote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4">Neue Verlaufsnotiz</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Datum</label>
                  <input type="date" className="input" value={noteForm.date}
                    onChange={e => setNoteForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Typ</label>
                  <select className="input" value={noteForm.noteType}
                    onChange={e => setNoteForm(f => ({...f, noteType: e.target.value}))}>
                    {Object.entries(NOTE_TYPE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Inhalt (§16a PThG)</label>
                <textarea className="input" rows={6} value={noteForm.content}
                  onChange={e => setNoteForm(f => ({...f, content: e.target.value}))}
                  placeholder="Interventionen, Verlauf, Absprachen, Veränderungen im Befinden…" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNewNote(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={addNote} disabled={savingNote || !noteForm.content} className="btn-primary flex-1 justify-center">
                {savingNote ? 'Speichern…' : 'Notiz speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neuer Test */}
      {newAssessment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Neuen Test anlegen</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Instrument</label>
                <select className="input" value={assessForm.instrumentId}
                  onChange={e => setAssessForm(f => ({...f, instrumentId: e.target.value}))}>
                  {instruments.map((i: any) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Anlass</label>
                <input className="input" placeholder="z.B. Ersterhebung, Verlauf Woche 4"
                  value={assessForm.occasion}
                  onChange={e => setAssessForm(f => ({...f, occasion: e.target.value}))} />
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700">
                Der Patient kann den Test mit seinem PIN ausfüllen, oder Sie können ihn direkt hier starten.
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNewAssessment(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={startAssessment} disabled={savingAssessment || !assessForm.instrumentId}
                className="btn-primary flex-1 justify-center">
                {savingAssessment ? 'Anlegen…' : 'Test starten'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
