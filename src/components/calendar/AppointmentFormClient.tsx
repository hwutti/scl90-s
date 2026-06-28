'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Save, Trash2, Calendar, Clock, User, FileText, RepeatIcon, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  mode: 'create' | 'edit'
  defaultDate?: string
  defaultTherapistId?: string
  appointment?: {
    id: string; patientId: string; therapistId: string; typeId: string
    startAt: string; status: string; isBlocker: boolean
    blockerNote: string; therapistNote: string; patientNote: string
    recurrenceId: string | null
  }
  types: any[]
  therapists: any[]
  patients: any[]
  currentUserId: string
  role: string
}

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Bestätigt' },
  { value: 'PENDING',   label: 'Anfrage' },
  { value: 'CANCELLED', label: 'Abgesagt' },
  { value: 'NO_SHOW',   label: 'No-Show' },
  { value: 'COMPLETED', label: 'Abgeschlossen' },
]

export function AppointmentFormClient({
  mode, defaultDate, defaultTherapistId, appointment,
  types, therapists, patients, currentUserId, role
}: Props) {
  const router = useRouter()

  const defaultStart = defaultDate
    ? `${defaultDate}T09:00`
    : appointment?.startAt
      ? new Date(appointment.startAt).toISOString().slice(0, 16)
      : ''

  const [form, setForm] = useState({
    patientId:     appointment?.patientId     ?? '',
    therapistId:   appointment?.therapistId   ?? defaultTherapistId ?? currentUserId,
    typeId:        appointment?.typeId         ?? types[0]?.id ?? '',
    startAt:       defaultStart,
    status:        appointment?.status         ?? 'CONFIRMED',
    isBlocker:     appointment?.isBlocker      ?? false,
    blockerNote:   appointment?.blockerNote    ?? '',
    therapistNote: appointment?.therapistNote  ?? '',
    patientNote:   appointment?.patientNote    ?? '',
    recurrence:    false,
    recurrenceFreq: 'WEEKLY',
    recurrenceCount: 12,
    cancelSeries:  false,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const selectedType = types.find(t => t.id === form.typeId)

  async function save() {
    setSaving(true)
    if (mode === 'create') {
      const payload: any = {
        patientId:     form.patientId   || null,
        therapistId:   form.therapistId,
        typeId:        form.typeId,
        startAt:       form.startAt,
        isBlocker:     form.isBlocker,
        blockerNote:   form.blockerNote  || null,
        therapistNote: form.therapistNote || null,
        status:        form.status,
      }
      if (form.recurrence) {
        const d = new Date(form.startAt)
        payload.recurrence = {
          freq:      form.recurrenceFreq,
          dayOfWeek: (d.getDay() + 6) % 7,
          startTime: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
          count:     form.recurrenceCount,
        }
      }
      await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch(`/api/appointments/${appointment!.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:        form.status,
          therapistNote: form.therapistNote,
          startAt:       form.startAt,
          typeId:        form.typeId,
          patientId:     form.patientId || null,
        }),
      })
    }
    setSaving(false)
    router.push('/calendar')
  }

  async function deleteAppt() {
    if (!appointment) return
    setDeleting(true)
    await fetch(`/api/appointments/${appointment.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', affectSeries: form.cancelSeries }),
    })
    setDeleting(false)
    router.push('/calendar')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/calendar')} className="btn-secondary p-2">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {mode === 'create' ? 'Neuer Termin' : 'Termin bearbeiten'}
          </h1>
          {defaultDate && (
            <p className="text-[var(--text-muted)] text-sm mt-0.5">
              {new Date(defaultDate + 'T00:00').toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Linke Spalte */}
        <div className="space-y-4">
          {/* Termintyp */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="font-semibold text-[var(--text-secondary)]">Terminart</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {types.map(t => (
                <button key={t.id} onClick={() => setForm(f => ({...f, typeId: t.id}))}
                  className={cn('p-3 rounded-xl border-2 text-left transition-all',
                    form.typeId === t.id ? 'shadow-sm' : 'border-[var(--border-strong)] hover:border-slate-300')}
                  style={form.typeId === t.id ? { borderColor: t.color, backgroundColor: t.color + '15' } : {}}>
                  <div className="w-3 h-3 rounded-full mb-1.5" style={{ backgroundColor: t.color }} />
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{t.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.durationMin} Min.</p>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input type="checkbox" checked={form.isBlocker}
                onChange={e => setForm(f => ({...f, isBlocker: e.target.checked}))} className="w-4 h-4 rounded" />
              <span className="text-sm text-[var(--text-secondary)]">Blockiertermin (kein Patient)</span>
            </label>
          </div>

          {/* Datum & Zeit */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="font-semibold text-[var(--text-secondary)]">Datum & Uhrzeit</h2>
            </div>
            <input type="datetime-local" className="input" value={form.startAt}
              onChange={e => setForm(f => ({...f, startAt: e.target.value}))} />
            {selectedType && form.startAt && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Ende: {(() => {
                  const end = new Date(new Date(form.startAt).getTime() + selectedType.durationMin * 60000)
                  return end.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
                })()} Uhr ({selectedType.durationMin} Min.)
              </p>
            )}
          </div>

          {/* Terminserie (nur bei create) */}
          {mode === 'create' && (
            <div className="card p-5">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <RepeatIcon className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="font-semibold text-[var(--text-secondary)]">Terminserie</span>
                <input type="checkbox" checked={form.recurrence} className="w-4 h-4 rounded ml-auto"
                  onChange={e => setForm(f => ({...f, recurrence: e.target.checked}))} />
              </label>
              {form.recurrence && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                  <div>
                    <label className="label">Frequenz</label>
                    <select className="input" value={form.recurrenceFreq}
                      onChange={e => setForm(f => ({...f, recurrenceFreq: e.target.value}))}>
                      <option value="WEEKLY">Wöchentlich</option>
                      <option value="BIWEEKLY">14-tägig</option>
                      <option value="MONTHLY">Monatlich</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Anzahl Termine</label>
                    <input type="number" className="input" min={2} max={104} value={form.recurrenceCount}
                      onChange={e => setForm(f => ({...f, recurrenceCount: parseInt(e.target.value)}))} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Serie absagen (nur bei edit mit recurrenceId) */}
          {mode === 'edit' && appointment?.recurrenceId && (
            <div className="card p-5 border-amber-200 bg-amber-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <RepeatIcon className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Gesamte Serie abbrechen</span>
                <input type="checkbox" checked={form.cancelSeries} className="w-4 h-4 rounded ml-auto"
                  onChange={e => setForm(f => ({...f, cancelSeries: e.target.checked}))} />
              </label>
              <p className="text-xs text-amber-700 mt-1.5">Alle zukünftigen Termine dieser Serie werden abgesagt.</p>
            </div>
          )}
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-4">
          {/* Patient */}
          {!form.isBlocker && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-secondary)]">Patient</h2>
              </div>
              <select className="input" value={form.patientId}
                onChange={e => setForm(f => ({...f, patientId: e.target.value}))}>
                <option value="">— kein Patient zugeordnet —</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Blockiergrund */}
          {form.isBlocker && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Ban className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-secondary)]">Grund</h2>
              </div>
              <input className="input" placeholder="z.B. Supervision, Fortbildung, Verwaltung"
                value={form.blockerNote}
                onChange={e => setForm(f => ({...f, blockerNote: e.target.value}))} />
            </div>
          )}

          {/* Therapeut (Admin) */}
          {role === 'ADMIN' && therapists.length > 1 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-secondary)]">Therapeut</h2>
              </div>
              <select className="input" value={form.therapistId}
                onChange={e => setForm(f => ({...f, therapistId: e.target.value}))}>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Status (nur bei edit) */}
          {mode === 'edit' && (
            <div className="card p-5">
              <h2 className="font-semibold text-[var(--text-secondary)] mb-3">Status</h2>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => setForm(f => ({...f, status: s.value}))}
                    className={cn('py-2 px-3 rounded-xl border text-sm font-medium transition-all',
                      form.status === s.value
                        ? 'border-transparent text-white'
                        : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-slate-300')}
                    style={form.status === s.value ? { backgroundColor: 'var(--color-primary)' } : {}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notizen */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="font-semibold text-[var(--text-secondary)]">Interne Notiz</h2>
            </div>
            <textarea className="input" rows={4} value={form.therapistNote}
              onChange={e => setForm(f => ({...f, therapistNote: e.target.value}))}
              placeholder="Nur für Therapeuten sichtbar…" />
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex gap-3">
        <button onClick={() => router.push('/calendar')} className="btn-secondary">
          <ChevronLeft className="w-4 h-4" /> Abbrechen
        </button>
        {mode === 'edit' && (
          <button onClick={deleteAppt} disabled={deleting}
            className="btn-danger">
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Wird abgesagt…' : form.cancelSeries ? 'Serie absagen' : 'Termin absagen'}
          </button>
        )}
        <button onClick={save} disabled={saving || !form.startAt || !form.typeId}
          className="btn-primary ml-auto">
          <Save className="w-4 h-4" />
          {saving ? 'Speichern…' : mode === 'create' && form.recurrence ? `${form.recurrenceCount} Termine anlegen` : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
