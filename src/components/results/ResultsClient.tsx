'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts'
import { Download, ArrowLeft, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { ScoringResult } from '@/lib/scoring'
import { tBandLabel, formatG, formatT } from '@/lib/scoring'
import { ITEMS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { formatDate, calcAge } from '@/lib/utils'

interface Props {
  sessionId: string
  patientName: string
  patientGender: string
  patientDob: string
  occasion: string
  startedAt: string
  scoring: ScoringResult
  answers: Record<number, number | null>
  backUrl?: string
  exportUrl?: string
}

const RISK_COLORS: Record<string, string> = {
  green:  '#10b981',
  yellow: '#f59e0b',
  red:    '#ef4444',
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="badge-gray">—</span>
  if (risk === 'green')  return <span className="badge-green">● Grün</span>
  if (risk === 'yellow') return <span className="badge-yellow">● Gelb</span>
  return <span className="badge-red">● Rot</span>
}

type ChartMode = 'bar' | 'radar'

export function ResultsClient({ sessionId, patientName, patientGender, patientDob, occasion, startedAt, scoring, answers, backUrl = '/dashboard', exportUrl }: Props) {
  const router = useRouter()
  const [chartMode, setChartMode] = useState<ChartMode>('bar')
  const [exporting, setExporting] = useState(false)

  const { scales, global: g } = scoring
  const mainScales = scales.filter(s => !s.isAddOn)
  const age = calcAge(patientDob)

  const chartData = mainScales.map(s => ({
    id: s.shortName,
    name: s.name,
    value: s.mean ?? 0,
    risk: s.risk,
    fill: RISK_COLORS[s.risk ?? 'green'] ?? '#6366f1',
  }))

  async function handleExport() {
    setExporting(true)
    const apiUrl = exportUrl ?? `/api/assessments/${sessionId}/export`
    const res = await fetch(apiUrl, { method: 'POST' })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SCL90S_${patientName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => router.push(backUrl)} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-2">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Auswertung SCL-90-S</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {patientName} · {patientGender || '—'} · Alter: {age ?? '—'} · {formatDate(startedAt)}
            {occasion && ` · ${occasion}`}
          </p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-primary">
          <Download className="w-4 h-4" />
          {exporting ? 'Erstelle PDF…' : 'PDF exportieren'}
        </button>
      </div>

      {/* Klinische Falldefinition */}
      <div className={cn('card p-5 flex items-start gap-4 border-l-4',
        g.isClinicalCase ? 'border-l-red-500 bg-red-50' : 'border-l-emerald-500 bg-emerald-50')}>
        {g.isClinicalCase
          ? <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          : <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />}
        <div>
          <p className={cn('font-semibold', g.isClinicalCase ? 'text-red-800' : 'text-emerald-800')}>
            {g.isClinicalCase ? 'Klinisch auffällig (Schritt 1: Falldefinition erfüllt)' : 'Kein klinischer Befund (Falldefinition nicht erfüllt)'}
          </p>
          {g.clinicalReason !== '—' && <p className="text-sm mt-0.5 text-slate-600">{g.clinicalReason}</p>}
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Falldefinition: T(GSI) ≥ 63 oder ≥ 2 Skalen mit T ≥ 63.
            Die SCL-90-S ist kein Diagnoseinstrument – klinische Einschätzung erforderlich.
          </p>
        </div>
      </div>

      {/* Globale Kennwerte */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'GS (Gesamtsumme)', value: g.gs.toString(), sub: 'Rohwert' },
          { label: 'GSI', value: g.gsi?.toFixed(3) ?? '—', sub: g.gsiT ? `T = ${Math.round(g.gsiT)}` : 'kein T-Wert' },
          { label: 'PST', value: g.pst.toString(), sub: g.pstT ? `T = ${Math.round(g.pstT)}` : 'Anzahl belasteter Items' },
          { label: 'PSDI', value: g.psdi?.toFixed(3) ?? '—', sub: g.psdiT ? `T = ${Math.round(g.psdiT)}` : 'Intensität' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-[var(--text-muted)] font-medium">{kpi.label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{kpi.value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" />
        Beantwortet: {g.answeredTotal} / 90 · Missing: {g.missingTotal}
      </p>

      {/* Diagramm */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Skalenprofil (Skalenwert G = Mittelwert)</h2>
          <div className="flex gap-1">
            {(['bar','radar'] as ChartMode[]).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  chartMode === m ? 'bg-indigo-600 text-white' : 'bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:bg-slate-200')}>
                {m === 'bar' ? 'Balken' : 'Radar'}
              </button>
            ))}
          </div>
        </div>

        {chartMode === 'bar' ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
              <XAxis dataKey="id" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 4]} ticks={[0,1,2,3,4]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(2), 'G']}
                labelFormatter={(l) => chartData.find(d => d.id === l)?.name ?? l}
              />
              <ReferenceLine y={0.5} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '0.5', fill: '#10b981', fontSize: 10 }} />
              <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '1.5', fill: '#f59e0b', fontSize: 10 }} />
              <Bar dataKey="value" radius={[6,6,0,0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="id" tick={{ fontSize: 11 }} />
              <Radar name="G" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              <Tooltip formatter={(v: number) => [v.toFixed(2), 'G']} />
            </RadarChart>
          </ResponsiveContainer>
        )}

        <div className="flex gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Grün: G &lt; 0.50</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Gelb: 0.50–1.49</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Rot: ≥ 1.50</span>
        </div>
      </div>

      {/* Skalen-Tabelle */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Skalenauswertung (Schritte 2–4)</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">G = Summe / (Items − Missing) · T-Werte nur bei hinterlegter Normtabelle · Fett = T ≥ 60 (auffällig)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-panel)] border-b border-slate-100">
              <tr>
                {['Skala','Items','Missing','Summe (S)','G','Ampel','P (>0)','T','T-Interpretation'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {scales.map(s => {
                const elevated = s.tScore !== null && s.tScore >= 60
                return (
                  <tr key={s.id} className={cn('hover:bg-[var(--surface-panel)]', elevated && !s.isAddOn ? 'bg-amber-50' : '')}>
                    <td className="px-3 py-2.5">
                      <span className={cn('font-semibold', elevated ? 'text-amber-800' : 'text-[var(--text-secondary)]')}>{s.id}</span>
                      <span className="text-[var(--text-muted)] ml-1.5 text-xs">{s.name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--text-muted)] font-mono">{s.items.join(', ')}</td>
                    <td className="px-3 py-2 text-center font-mono">{s.missing}</td>
                    <td className="px-3 py-2 text-center font-mono font-semibold">{s.sum}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold">{formatG(s.mean)}</td>
                    <td className="px-3 py-2"><RiskBadge risk={s.risk} /></td>
                    <td className="px-3 py-2 text-center font-mono">{s.pCount}</td>
                    <td className={cn('px-3 py-2 text-center font-mono font-bold', elevated ? 'text-amber-700' : '')}>
                      {formatT(s.tScore)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.tScore !== null ? tBandLabel(s.tScore) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schritt 4: Auffällige Items */}
      {scales.filter(s => !s.isAddOn && s.flaggedItems.length > 0 && (s.tScore ?? 0) >= 60).length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-[var(--text-secondary)] mb-3">Schritt 4 – Auffällige Items (Wert ≥ 2 bei Skalen mit T ≥ 60)</h2>
          <div className="space-y-3">
            {scales
              .filter(s => !s.isAddOn && s.flaggedItems.length > 0 && (s.tScore ?? 0) >= 60)
              .map(s => (
                <div key={s.id}>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">{s.id} – {s.name}</p>
                  <div className="space-y-1">
                    {s.flaggedItems.map(itemNo => (
                      <div key={itemNo} className="flex items-start gap-2 text-xs">
                        <span className="badge-red shrink-0 mt-0.5">Item {itemNo}: {answers[itemNo]}</span>
                        <span className="text-slate-600">{ITEMS[itemNo - 1]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-800">
        <p className="font-semibold mb-1">⚠ Wichtiger Hinweis</p>
        <p>Die SCL-90-S ist kein Diagnoseinstrument und dient ausschließlich der Verlaufs- und Erfolgskontrolle sowie dem Screening.
        Eine Pathologisierung auf Basis dieser Ergebnisse ist ausdrücklich zu vermeiden (Franke, 2014).
        Die Interpretation erfordert klinische Fachkompetenz.</p>
      </div>
    </div>
  )
}
