'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star } from 'lucide-react'

interface NormTable {
  id: string; name: string; population: string; gender: string | null
  ageMin: number | null; ageMax: number | null; sampleSize: number | null
  source: string | null; isDefault: boolean; createdAt: string
}

const POPULATIONS: Record<string, string> = {
  GENERAL_POPULATION: 'Allgemeinbevölkerung',
  STUDENTS: 'Studierende',
  CLINICAL_INPATIENT: 'Stationäre Psychotherapie',
  CLINICAL_REHAB: 'Orthopädische Rehabilitation',
  CUSTOM: 'Benutzerdefiniert',
}

export function NormTablesClient({ tables }: { tables: NormTable[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [jsonError, setJsonError] = useState('')
  const [form, setForm] = useState({
    name: '', population: 'GENERAL_POPULATION', gender: '',
    ageMin: '', ageMax: '', sampleSize: '', source: '', values: '', isDefault: false,
  })

  async function save() {
    setJsonError('')
    let parsed
    try { parsed = JSON.parse(form.values) } catch { setJsonError('Ungültiges JSON'); return }
    setLoading(true)
    await fetch('/api/norm-tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, values: parsed, ageMin: form.ageMin ? Number(form.ageMin) : null, ageMax: form.ageMax ? Number(form.ageMax) : null, sampleSize: form.sampleSize ? Number(form.sampleSize) : null }),
    })
    setLoading(false)
    setCreating(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Normwert-Tabellen</h1>
          <p className="text-slate-500 text-sm mt-0.5">Franke (2014) – Hogrefe-Lizenz erforderlich</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Normtabelle importieren
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>⚠ Lizenzhinweis:</strong> Die offiziellen Normwerte (Franke, 2014) sind urheberrechtlich geschützt und
        müssen separat beim Hogrefe-Verlag lizenziert werden. Dieses System ermöglicht den Import eigener Normwerte.
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Normtabelle importieren</h2>
            <div className="space-y-3">
              <div><label className="label">Name</label>
                <input className="input" placeholder="z.B. Allgemeinbevölkerung männlich 18–65"
                  value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Population</label>
                  <select className="input" value={form.population} onChange={e => setForm(f=>({...f,population:e.target.value}))}>
                    {Object.entries(POPULATIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                <div><label className="label">Geschlecht</label>
                  <select className="input" value={form.gender} onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
                    <option value="">Gemischt</option>
                    <option value="männlich">Männlich</option>
                    <option value="weiblich">Weiblich</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Alter von</label>
                  <input type="number" className="input" placeholder="16" value={form.ageMin} onChange={e => setForm(f=>({...f,ageMin:e.target.value}))} /></div>
                <div><label className="label">Alter bis</label>
                  <input type="number" className="input" placeholder="75" value={form.ageMax} onChange={e => setForm(f=>({...f,ageMax:e.target.value}))} /></div>
                <div><label className="label">Stichprobengröße</label>
                  <input type="number" className="input" placeholder="2025" value={form.sampleSize} onChange={e => setForm(f=>({...f,sampleSize:e.target.value}))} /></div>
              </div>
              <div><label className="label">Quelle</label>
                <input className="input" placeholder="Franke, G.H. (2014). SCL-90-S Manual."
                  value={form.source} onChange={e => setForm(f=>({...f,source:e.target.value}))} /></div>
              <div>
                <label className="label">Normwerte (JSON)</label>
                <textarea className="input font-mono text-xs" rows={8}
                  placeholder={`{\n  "scales": {\n    "SOM": {"mean": 0.00, "sd": 0.00},\n    "ZWA": {"mean": 0.00, "sd": 0.00}\n  },\n  "gsi":  {"mean": 0.00, "sd": 0.00},\n  "pst":  {"mean": 0, "sd": 0},\n  "psdi": {"mean": 0.00, "sd": 0.00}\n}`}
                  value={form.values} onChange={e => setForm(f=>({...f,values:e.target.value}))} />
                {jsonError && <p className="text-xs text-red-600 mt-1">{jsonError}</p>}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f=>({...f,isDefault:e.target.checked}))} />
                Als Standard-Normtabelle setzen
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setCreating(false)} className="btn-secondary flex-1">Abbrechen</button>
              <button onClick={save} disabled={loading || !form.name || !form.values} className="btn-primary flex-1 justify-center">
                {loading ? 'Importiere…' : 'Importieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {tables.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p>Noch keine Normtabellen importiert.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name','Population','Geschlecht','Alter','N','Quelle','Standard'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tables.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{POPULATIONS[t.population] ?? t.population}</td>
                  <td className="px-4 py-3 text-slate-500">{t.gender ?? 'Gemischt'}</td>
                  <td className="px-4 py-3 text-slate-500">{t.ageMin && t.ageMax ? `${t.ageMin}–${t.ageMax}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{t.sampleSize ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{t.source ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.isDefault && <span className="flex items-center gap-1 text-amber-600"><Star className="w-3.5 h-3.5" /> Standard</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
