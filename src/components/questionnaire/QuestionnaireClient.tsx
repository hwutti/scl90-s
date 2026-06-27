'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ITEMS, SCALES, ITEM_TO_SCALES, SCORE_LABELS } from '@/lib/constants'
import { ChevronLeft, ChevronRight, BarChart3, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  sessionId: string
  patientName: string
  patientGender: string
  patientDob: string
  occasion: string
  initialAnswers: Record<number, number | null>
  apiBase?: string  // '/api/assessments' (neu) oder '/api/sessions' (legacy)
}

const SCORE_COLORS = [
  'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200',
  'bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200',
  'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200',
  'bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200',
  'bg-red-100 border-red-300 text-red-800 hover:bg-red-200',
]
const SCORE_COLORS_ACTIVE = [
  'bg-emerald-500 border-emerald-600 text-white',
  'bg-sky-500 border-sky-600 text-white',
  'bg-amber-500 border-amber-600 text-white',
  'bg-orange-500 border-orange-600 text-white',
  'bg-red-600 border-red-700 text-white',
]

export function QuestionnaireClient({ sessionId, patientName, patientDob, patientGender, occasion, initialAnswers, apiBase = '/api/assessments' }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<number, number | null>>(initialAnswers)
  const [currentIdx, setCurrentIdx] = useState(0)  // 0-basiert
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  const answered = Object.values(answers).filter(v => v !== null).length
  const pct = Math.round((answered / 90) * 100)
  const currentItem = currentIdx + 1
  const currentValue = answers[currentItem]
  const scales = ITEM_TO_SCALES.get(currentItem) ?? []

  // Zum ersten unbeantworteten Item springen beim Laden
  useEffect(() => {
    for (let i = 1; i <= 90; i++) {
      if (answers[i] === null) { setCurrentIdx(i - 1); break }
    }
  }, [])

  // Aktives Item in Liste scrollen
  useEffect(() => {
    const el = listRef.current?.querySelector('.q-active')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIdx])

  // Keyboard-Navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return
      if (e.key === 'ArrowLeft')  setCurrentIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setCurrentIdx(i => Math.min(89, i + 1))
      if (['0','1','2','3','4'].includes(e.key)) selectAnswer(currentIdx + 1, Number(e.key))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIdx, answers])

  const saveAnswer = useCallback(async (itemNumber: number, value: number) => {
    // Pro-Item-Debounce: cancelt nur Doppelklick auf dasselbe Item,
    // löscht NICHT den Speicher-Timer für andere Items
    const existing = saveTimeouts.current.get(itemNumber)
    if (existing) clearTimeout(existing)
    const t = setTimeout(async () => {
      saveTimeouts.current.delete(itemNumber)
      setSaving(true)
      await fetch(`${apiBase}/${sessionId}/answers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemNumber, value }),
      })
      setSaving(false)
    }, 300)
    saveTimeouts.current.set(itemNumber, t)
  }, [sessionId])

  function selectAnswer(itemNo: number, value: number) {
    setAnswers(prev => ({ ...prev, [itemNo]: value }))
    saveAnswer(itemNo, value)
    if (itemNo < 90) setCurrentIdx(itemNo)  // automatisch weiter
  }

  async function handleScore() {
    setScoring(true)
    const res = await fetch(`${apiBase}/${sessionId}/score`, { method: 'POST' })
    const data = await res.json()
    setScoring(false)
    if (data.ok) router.push(`/session/${sessionId}/results`)
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-7rem)]">
      {/* Item-Liste links */}
      <div className="hidden lg:flex flex-col w-64 shrink-0">
        <div className="card flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</span>
            <span className="badge-blue text-xs">{answered} / 90</span>
          </div>
          <div ref={listRef} className="overflow-y-auto flex-1 p-2">
            {ITEMS.map((item, idx) => {
              const val = answers[idx + 1]
              const isActive = idx === currentIdx
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={cn(
                    'q-item w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all mb-0.5',
                    isActive ? 'q-active bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50',
                  )}
                >
                  <span className={cn(
                    'flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold',
                    val !== null ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  )}>
                    {val !== null ? val : idx + 1}
                  </span>
                  <span className={cn('truncate', isActive ? 'text-indigo-700 font-medium' : 'text-slate-500')}>
                    {item.substring(0, 35)}{item.length > 35 ? '…' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Hauptbereich rechts */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Patient Info */}
        <div className="card px-5 py-3 flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-xs text-slate-400">Patient</span>
            <p className="text-sm font-semibold text-slate-800">{patientName || '—'}</p>
          </div>
          {patientGender && <div><span className="text-xs text-slate-400">Geschlecht</span><p className="text-sm">{patientGender}</p></div>}
          {occasion && <div><span className="text-xs text-slate-400">Anlass</span><p className="text-sm">{occasion}</p></div>}
          {saving && <span className="text-xs text-slate-400 ml-auto animate-pulse">Speichert…</span>}
        </div>

        {/* Aktuelle Frage */}
        <div className="card flex-1 flex flex-col p-6">
          {/* Item-Nummer + Skala */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-lg">
                {currentItem}
              </span>
              <div>
                <p className="text-xs text-slate-400">Item {currentItem} von 90</p>
                {scales.length > 0 && (
                  <p className="text-xs text-indigo-600 font-medium">Skala: {scales.join(', ')}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
                currentValue === null ? 'badge-gray' : 'badge-green')}>
                {currentValue !== null ? `Wert: ${currentValue}` : 'Offen'}
              </span>
            </div>
          </div>

          {/* Fragentext */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-slate-500 text-sm mb-2">Wie sehr litten Sie in den letzten 7 Tagen unter…</p>
            <h2 className="text-xl font-semibold text-slate-800 leading-relaxed mb-8">
              {ITEMS[currentIdx]}
            </h2>

            {/* Antwort-Buttons */}
            <div className="grid grid-cols-5 gap-3">
              {[0,1,2,3,4].map(score => (
                <button
                  key={score}
                  onClick={() => selectAnswer(currentItem, score)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 font-bold text-xl transition-all active:scale-95',
                    currentValue === score
                      ? SCORE_COLORS_ACTIVE[score]
                      : SCORE_COLORS[score]
                  )}
                >
                  {score}
                  <span className="text-xs font-normal opacity-75 text-center leading-tight px-1">
                    {SCORE_LABELS[score]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="btn-secondary"
              >
                <ChevronLeft className="w-4 h-4" /> Zurück
              </button>
              <button
                onClick={() => setCurrentIdx(i => Math.min(89, i + 1))}
                disabled={currentIdx === 89}
                className="btn-secondary"
              >
                Weiter <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Fortschritt */}
            <div className="flex-1 min-w-32">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{answered} beantwortet</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleScore}
              disabled={scoring || answered < 85}
              title={answered < 85 ? `Noch ${85 - answered} Items offen` : 'Auswertung berechnen'}
              className="btn-primary"
            >
              {scoring
                ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Berechne…</>
                : <><BarChart3 className="w-4 h-4" /> Auswertung</>
              }
            </button>
          </div>
        </div>

        {/* Keyboard-Hint */}
        <p className="text-center text-xs text-slate-400">
          Tastatur: <kbd className="bg-slate-100 px-1.5 py-0.5 rounded">0</kbd>–<kbd className="bg-slate-100 px-1.5 py-0.5 rounded">4</kbd> Wert wählen ·
          <kbd className="bg-slate-100 px-1.5 py-0.5 rounded ml-1">←</kbd><kbd className="bg-slate-100 px-1.5 py-0.5 rounded">→</kbd> navigieren
        </p>
      </div>
    </div>
  )
}
