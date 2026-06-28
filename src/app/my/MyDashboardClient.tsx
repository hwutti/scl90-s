'use client'
import { useRouter } from 'next/navigation'
import { ClipboardList, Clock, CheckCircle, AlertCircle, ChevronRight, Download, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Ausstehend', IN_PROGRESS: 'Begonnen',
  COMPLETED: 'Abgeschlossen', SCORED: 'Ausgewertet', LOCKED: 'Gesperrt',
}

function formatDate(s: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(s))
}

export function MyDashboardClient({ patient, assessments, userName }: any) {
  const router = useRouter()

  const open = assessments.filter((a: any) => ['ASSIGNED','IN_PROGRESS'].includes(a.status))
  const done = assessments.filter((a: any) => ['SCORED','LOCKED','COMPLETED'].includes(a.status))

  async function downloadPdf(assessmentId: string, lastName: string, date: string) {
    const res = await fetch(`/api/assessments/${assessmentId}/export`, { method: 'POST' })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SCL90S_${lastName}_${date}.pdf`
    a.click()
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Begrüßung */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Guten Tag, {userName.split(' ')[0]}!</h1>
        {patient?.therapists?.[0] && (
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Behandelnde Person: {patient.therapists[0].therapist.name}
          </p>
        )}
      </div>

      {/* Offene Tests */}
      {open.length > 0 && (
        <div>
          <h2 className="font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" /> Ausstehende Tests
          </h2>
          <div className="space-y-2">
            {open.map((a: any) => (
              <div
                key={a.id}
                onClick={() => router.push(`/assessment/${a.id}`)}
                className="card p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--color-primary-light)] border-2 border-[var(--border)] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{a.instrument.name}</p>
                  <p className="text-xs text-slate-400">
                    {a.occasion || 'Erhebung'} · {formatDate(a.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-blue text-xs">{STATUS_LABEL[a.status]}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open.length === 0 && (
        <div className="card p-6 text-center text-slate-400">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <p className="text-sm">Keine offenen Tests – gut gemacht!</p>
        </div>
      )}

      {/* Abgeschlossene Tests */}
      {done.length > 0 && (
        <div>
          <h2 className="font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" /> Meine Ergebnisse
          </h2>
          <div className="space-y-2">
            {done.map((a: any) => {
              const scores = a.result?.scores as any
              const gsiT = scores?.gsiT ? Math.round(scores.gsiT) : null
              const isClinical = a.result?.isClinicalCase
              return (
                <div key={a.id} className="card p-4 flex items-center gap-4">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => router.push(`/assessment/${a.id}/results`)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-slate-800">{a.instrument.shortName}</p>
                      {a.occasion && <span className="text-xs text-slate-400">· {a.occasion}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{formatDate(a.createdAt)}</span>
                      {gsiT && (
                        <span className={cn(
                          'text-xs font-semibold px-1.5 py-0.5 rounded',
                          isClinical ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        )}>
                          GSI T={gsiT}
                        </span>
                      )}
                      {isClinical === true && <AlertCircle className="w-3 h-3 text-red-400" />}
                      {isClinical === false && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                    </div>
                  </div>
                  {(a.status === 'SCORED' || a.status === 'LOCKED') && (
                    <button
                      onClick={() => downloadPdf(a.id, patient?.lastName ?? 'Patient', a.createdAt.slice(0,10))}
                      className="btn-secondary p-2"
                      title="PDF herunterladen"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/assessment/${a.id}/results`)}
                    className="btn-secondary p-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card p-4 bg-amber-50 border border-amber-100">
        <p className="text-xs text-amber-800 leading-relaxed">
          Die hier angezeigten Testergebnisse dienen der Verlaufskontrolle und sind kein Diagnoseinstrument.
          Bitte besprechen Sie Ihre Ergebnisse mit Ihrer behandelnden Person.
        </p>
      </div>
    </div>
  )
}
