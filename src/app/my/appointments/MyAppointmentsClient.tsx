'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Check, Plus, ChevronRight, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING:   { label: 'Anfrage gestellt', class: 'badge-yellow' },
  CONFIRMED: { label: 'Bestätigt',        class: 'badge-green' },
  COMPLETED: { label: 'Abgeschlossen',    class: 'badge-gray' },
  NO_SHOW:   { label: 'Nicht erschienen', class: 'badge-red' },
}

function formatDT(s: string) {
  const d = new Date(s)
  return {
    date: d.toLocaleDateString('de-AT', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }),
    time: d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function MyAppointmentsClient({ appointments, therapists, types, patientId }: any) {
  const router = useRouter()
  const now = new Date()
  const upcoming = appointments.filter((a: any) => new Date(a.startAt) >= now)
  const past     = appointments.filter((a: any) => new Date(a.startAt) <  now)

  const [booking, setBooking] = useState(false)
  const [step, setStep] = useState<'type' | 'slot'>('type')
  const [selectedType, setSelectedType] = useState<any>(null)
  const [selectedTherapist, setSelectedTherapist] = useState(therapists[0]?.id ?? '')
  const [slots, setSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [waitlist, setWaitlist] = useState(false)

  async function loadSlots(typeId: string, therapistId: string) {
    setLoadingSlots(true)
    const type = types.find((t: any) => t.id === typeId)
    const from = new Date(); from.setDate(from.getDate() + 1)
    const to   = new Date(); to.setDate(to.getDate() + 42)
    const res = await fetch(`/api/calendar/slots?therapistId=${therapistId}&from=${from.toISOString()}&to=${to.toISOString()}&duration=${type?.durationMin ?? 50}`)
    const data = await res.json()
    setSlots(data.slice(0, 30))
    setLoadingSlots(false)
  }

  async function submitBooking() {
    if (!selectedSlot) return
    setSaving(true)
    await fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId, typeId: selectedType.id, therapistId: selectedTherapist,
        startAt: selectedSlot.startAt, patientNote: note,
      }),
    })
    setSaving(false); setBooking(false); setStep('type'); setSelectedSlot(null); setNote('')
    router.refresh()
  }

  async function joinWaitlist() {
    await fetch('/api/waitlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ therapistId: selectedTherapist, typeId: selectedType?.id, preferredDays: [], preferredTime: 'any' }),
    })
    setWaitlist(false); setBooking(false)
    router.refresh()
  }

  // Slots nach Datum gruppieren
  const slotsByDate: Record<string, any[]> = {}
  for (const s of slots) {
    const key = new Date(s.startAt).toLocaleDateString('de-AT', { weekday:'short', day:'2-digit', month:'short' })
    if (!slotsByDate[key]) slotsByDate[key] = []
    slotsByDate[key].push(s)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meine Termine</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{upcoming.length} bevorstehende Termine</p>
        </div>
        <button onClick={() => { setBooking(true); setStep('type') }} className="btn-primary">
          <Plus className="w-4 h-4" /> Termin anfragen
        </button>
      </div>

      {/* Bevorstehende */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="font-semibold text-[var(--text-secondary)] mb-3">Bevorstehende Termine</h2>
          <div className="space-y-2">
            {upcoming.map((a: any) => {
              const { date, time } = formatDT(a.startAt)
              const s = STATUS_MAP[a.status]
              return (
                <div key={a.id} className="card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: a.type.color + '20' }}>
                    <Calendar className="w-5 h-5" style={{ color: a.type.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{a.type.name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{date} · {time} Uhr · {a.therapist.name}</p>
                  </div>
                  <span className={cn('text-xs', s?.class)}>{s?.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {upcoming.length === 0 && (
        <div className="card py-12 text-center text-slate-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Keine bevorstehenden Termine.</p>
          <button onClick={() => { setBooking(true); setStep('type') }} className="btn-primary mt-4">
            Ersten Termin anfragen
          </button>
        </div>
      )}

      {/* Vergangene */}
      {past.length > 0 && (
        <div>
          <h2 className="font-semibold text-[var(--text-secondary)] mb-3">Vergangene Termine</h2>
          <div className="space-y-2">
            {past.slice(0,5).map((a: any) => {
              const { date, time } = formatDT(a.startAt)
              return (
                <div key={a.id} className="card p-3 flex items-center gap-3 opacity-60">
                  <Calendar className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-slate-700">{a.type.name}</span>
                    <span className="text-[var(--text-muted)] ml-2">{date}</span>
                  </div>
                  <span className="badge-gray text-xs">{STATUS_MAP[a.status]?.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Buchungs-Modal */}
      {booking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {step === 'type' ? 'Terminart wählen' : 'Freien Termin wählen'}
              </h2>
              <button onClick={() => { setBooking(false); setStep('type') }} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
            </div>

            {step === 'type' && (
              <div className="space-y-4">
                {therapists.length > 1 && (
                  <div>
                    <label className="label">Therapeut</label>
                    <select className="input" value={selectedTherapist} onChange={e => setSelectedTherapist(e.target.value)}>
                      {therapists.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Terminart</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {types.map((t: any) => (
                      <button key={t.id}
                        onClick={() => setSelectedType(t)}
                        className={cn('p-3 rounded-xl border-2 text-left transition-all',
                          selectedType?.id === t.id
                            ? 'border-current shadow-sm'
                            : 'border-[var(--border-strong)] hover:border-slate-300')}
                        style={selectedType?.id === t.id ? { borderColor: t.color, backgroundColor: t.color + '10' } : {}}>
                        <div className="w-3 h-3 rounded-full mb-1.5" style={{ backgroundColor: t.color }} />
                        <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.durationMin} Min.</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setBooking(false)} className="btn-secondary flex-1">Abbrechen</button>
                  <button
                    disabled={!selectedType}
                    onClick={() => { setStep('slot'); loadSlots(selectedType.id, selectedTherapist) }}
                    className="btn-primary flex-1 justify-center">
                    Weiter <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 'slot' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--surface-panel)] text-sm">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedType?.color }} />
                  <span className="font-medium">{selectedType?.name}</span>
                  <span className="text-slate-400">· {selectedType?.durationMin} Min.</span>
                  <button onClick={() => setStep('type')} className="ml-auto text-xs text-[var(--text-muted)] hover:text-slate-600">Ändern</button>
                </div>

                {loadingSlots ? (
                  <div className="py-12 text-center text-slate-400">Freie Termine werden geladen…</div>
                ) : Object.keys(slotsByDate).length === 0 ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                    <p className="text-[var(--text-secondary)] font-medium mb-1">Keine freien Termine in den nächsten 6 Wochen</p>
                    <p className="text-[var(--text-muted)] text-sm mb-4">Sie können sich auf die Warteliste setzen lassen.</p>
                    <button onClick={() => setWaitlist(true)} className="btn-secondary">Auf Warteliste setzen</button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {Object.entries(slotsByDate).map(([date, daySlots]) => (
                      <div key={date}>
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">{date}</p>
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map((s: any, i: number) => (
                            <button key={i}
                              onClick={() => setSelectedSlot(s)}
                              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                                selectedSlot?.startAt === s.startAt
                                  ? 'text-white border-transparent'
                                  : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-slate-300')}
                              style={selectedSlot?.startAt === s.startAt ? { backgroundColor: selectedType?.color } : {}}>
                              {new Date(s.startAt).toLocaleTimeString('de-AT', { hour:'2-digit', minute:'2-digit' })}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedSlot && (
                  <div>
                    <label className="label">Hinweis an den Therapeuten (optional)</label>
                    <textarea className="input" rows={2} value={note} onChange={e => setNote(e.target.value)}
                      placeholder="z.B. Thema das ich besprechen möchte…" />
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep('type')} className="btn-secondary flex-1">Zurück</button>
                  <button onClick={submitBooking} disabled={!selectedSlot || saving} className="btn-primary flex-1 justify-center">
                    {saving ? 'Senden…' : 'Terminanfrage senden'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wartelisten-Bestätigung */}
      {waitlist && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
            <Clock className="w-10 h-10 mx-auto mb-3 text-amber-400" />
            <h2 className="font-bold text-[var(--text-primary)] mb-2">Auf Warteliste setzen?</h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">Sie werden benachrichtigt, sobald ein Termin frei wird.</p>
            <div className="flex gap-3">
              <button onClick={() => setWaitlist(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={joinWaitlist} className="btn-primary flex-1 justify-center">Ja, eintragen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
