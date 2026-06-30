'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Play, RotateCcw, AlertCircle } from 'lucide-react'

interface MigrationArea {
  id: string; label: string; emoji: string
  status: 'found' | 'empty' | 'unsupported' | 'pdf_only'
  count: number; description: string; canImport: boolean; items: any[]
}
interface MigrationPreview {
  areas: MigrationArea[]; sourceHash: string; alreadyImported: boolean
  previousImport: { ranAt: string; stats: any } | null
}
interface MigrationResult {
  patients: number; patientsSkipped: number; sessions: number; sessionsSkipped: number
  transactions: number; diagnoses: number; supervisions: number; warnings: string[]
}

const STATUS_CFG = {
  found:       { color: 'var(--green)',       Icon: CheckCircle,    label: 'Daten vorhanden' },
  empty:       { color: 'var(--text-muted)',   Icon: AlertCircle,    label: 'Keine Daten eingegeben' },
  unsupported: { color: 'var(--text-muted)',   Icon: XCircle,        label: 'In KDS nicht unterstützt' },
  pdf_only:    { color: 'var(--amber)',         Icon: AlertTriangle,  label: 'Nur als PDF vorhanden' },
}

const fmtDate = (s: string) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s))

function PreviewTable({ area }: { area: MigrationArea }) {
  const items = area.items.slice(0, 20)
  const td = (s: string | number | null | undefined, muted?: boolean) => (
    <td style={{ padding: '3px 8px', color: muted ? 'var(--text-muted)' : 'inherit' }}>{s ?? '–'}</td>
  )
  const th = (...labels: string[]) => (
    <thead><tr style={{ color: 'var(--text-muted)' }}>{labels.map((l,i) => <td key={i} style={{ padding: '2px 8px' }}>{l}</td>)}</tr></thead>
  )
  const tbody = (rows: React.ReactNode[]) => <tbody>{rows}</tbody>
  const tr = (i: number, cells: React.ReactNode[]) => (
    <tr key={i} style={{ borderTop: '0.5px solid var(--border)' }}>{cells}</tr>
  )
  const tbl = (head: React.ReactNode, body: React.ReactNode) => (
    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>{head}{body}</table>
  )

  if (area.id === 'profiles') return tbl(
    th('Nr.','Codename','Name','Diagnosen','Preis'),
    tbody(items.map((p: any, i) => tr(i, [td(p.profilNr, true), td(p.codeName), td(p.fullName), td(p.diagnoses?.join(', ') || '–', !p.diagnoses?.length), td(p.unitPriceNet ? p.unitPriceNet + ' €' : '–', true)])))
  )
  if (area.id === 'sessions') return tbl(
    th('Datum','Codename','Min','Leistung','Supervision'),
    tbody(items.map((s: any, i) => tr(i, [td(s.date), td(s.codeName), td(s.durationMinutes, true), td(s.serviceLabel), td(s.supervisorName || '–', !s.supervisorName)])))
  )
  if (area.id === 'rechnungen_einnahmen') return tbl(
    th('Nr.','Datum','Patient','Betrag','Status'),
    tbody(items.map((inv: any, i) => tr(i, [td(inv.invoiceNr), td(inv.date), td(inv.patientName), td(inv.amount + ' €'), <td key="s" style={{ padding: '3px 8px', color: inv.paidDate ? 'var(--green)' : 'var(--amber)' }}>{inv.paidDate ? '✓ Bezahlt' : 'Offen'}</td>])))
  )
  if (area.id === 'finanzexport') return tbl(
    th('Beleg','Datum','Typ','Betrag','Text'),
    tbody(items.map((r: any, i) => tr(i, [td(r.belegnr), td(r.belegdatum), <td key="t" style={{ padding: '3px 8px', color: r.typ === 'E' ? 'var(--green)' : 'var(--red)' }}>{r.typ === 'E' ? 'Einnahme' : 'Ausgabe'}</td>, td(r.betrag + ' €'), <td key="txt" style={{ padding: '3px 8px', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</td>])))
  )
  if (area.id === 'supervision') return tbl(
    th('Name','Codename','Supervisor:in','Datum'),
    tbody(items.map((s: any, i) => tr(i, [td(s.supervisionName), td(s.codeName), td(s.supervisorName), td(s.supervisionDate)])))
  )
  return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>{items.map((item: any, i) => <div key={i}>{item.filename ?? JSON.stringify(item)}</div>)}</div>
}

export function MigrationClient() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set())
  const [expandedArea, setExpandedArea] = useState<string | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(rar|zip)$/i)) { setError('Bitte eine .rar oder .zip Datei (TheraPsy-Export) hochladen.'); return }
    setError(null); setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/admin/migration/parse', { method: 'POST', body: form })
      let data: any
      try { data = await res.json() } catch { setError('Server-Fehler: Antwort war kein gültiges JSON. Möglicherweise ist die Datei zu groß (max. 50 MB) oder der Server hat einen internen Fehler.'); return }
      if (!res.ok) { setError(data.error ?? 'Fehler beim Verarbeiten.'); return }
      setPreview(data)
      setSelectedAreas(new Set(data.areas.filter((a: MigrationArea) => a.canImport).map((a: MigrationArea) => a.id)))
      setStep('preview')
    } catch (e: any) { setError(e.message ?? 'Netzwerkfehler') }
    finally { setUploading(false) }
  }, [])

  async function runImport() {
    if (!preview) return
    setStep('importing')
    try {
      const getItems = (id: string) => preview.areas.find(a => a.id === id)?.items ?? []
      const res = await fetch('/api/admin/migration/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceHash: preview.sourceHash, selectedAreas: Array.from(selectedAreas),
          patients: getItems('profiles'), sessions: getItems('sessions'),
          invoices: getItems('rechnungen_einnahmen'), bmdRows: getItems('finanzexport') }),
      })
      let data: any
      try { data = await res.json() } catch { setError('Server-Fehler beim Import.'); setStep('preview'); return }
      if (!res.ok) { setError(data.error ?? 'Fehler.'); setStep('preview'); return }
      setResult(data.result); setStep('done')
    } catch (e: any) { setError(e.message ?? 'Netzwerkfehler'); setStep('preview') }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>TheraPsy-Migration</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Importiert Klient:innen, Sitzungen, Rechnungen und Supervisionsdaten aus einem TheraPsy-Export.</p>

      {step === 'upload' && (
        <div>
          <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--surface-2)' : 'var(--surface-card)', transition: 'all 0.15s' }}>
            <Upload style={{ width: 36, height: 36, color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>TheraPsy-Export hier ablegen</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>.rar oder .zip — aus TheraPsy → Dateien exportieren</p>
            {uploading && <p style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 12 }}>Wird verarbeitet…</p>}
            <input ref={fileRef} type="file" accept=".rar,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          {preview.alreadyImported && preview.previousImport && (
            <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 12, color: 'var(--amber)', marginBottom: 16 }}>
              ⚠ Diese Export-Datei wurde bereits am {fmtDate(preview.previousImport.ranAt)} importiert. Bereits vorhandene Klient:innen (gleicher Codename) und Sitzungen werden automatisch übersprungen.
            </div>
          )}
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Gefundene Bereiche — auswählen was importiert werden soll</h2>

          {preview.areas.map(area => {
            const cfg = STATUS_CFG[area.status]
            const isExpanded = expandedArea === area.id
            const isSelected = selectedAreas.has(area.id)
            return (
              <div key={area.id} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                  {area.canImport
                    ? <input type="checkbox" checked={isSelected} onChange={() => setSelectedAreas(prev => { const n = new Set(prev); if (n.has(area.id)) n.delete(area.id); else n.add(area.id); return n })} style={{ width: 16, height: 16, flexShrink: 0, accentColor: 'var(--color-primary)' }} />
                    : <div style={{ width: 16, height: 16, flexShrink: 0 }} />}
                  <span style={{ fontSize: 20 }}>{area.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{area.label}</strong>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: area.status === 'found' ? '#f0fdf4' : 'var(--surface-2)', color: cfg.color }}>
                        {area.count > 0 ? `${area.count} Einträge` : cfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>{area.description}</p>
                  </div>
                  {area.items.length > 0 && (
                    <button onClick={() => setExpandedArea(isExpanded ? null : area.id)} className="btn-ghost" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                      Vorschau {isExpanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                    </button>
                  )}
                </div>
                {isExpanded && area.items.length > 0 && (
                  <div style={{ borderTop: '0.5px solid var(--border)', padding: 12, background: 'var(--surface-2)', maxHeight: 260, overflowY: 'auto' }}>
                    <PreviewTable area={area} />
                  </div>
                )}
              </div>
            )
          })}

          {error && <div style={{ padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8, fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <button onClick={() => { setStep('upload'); setPreview(null); setError(null) }} className="btn-ghost" style={{ fontSize: 13 }}>
              <RotateCcw style={{ width: 13, height: 13 }} /> Andere Datei
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedAreas.size} Bereich{selectedAreas.size !== 1 ? 'e' : ''} ausgewählt</span>
              <button onClick={runImport} disabled={selectedAreas.size === 0} className="btn-primary" style={{ fontSize: 13 }}>
                <Play style={{ width: 13, height: 13 }} /> Import starten
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>Import läuft…</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bitte warten, Datenbank wird befüllt.</p>
        </div>
      )}

      {step === 'done' && result && (
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <CheckCircle style={{ width: 22, height: 22, color: 'var(--green)' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Import abgeschlossen</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[['Klient:innen', result.patients], ['Übersprungen', result.patientsSkipped], ['Sitzungen', result.sessions], ['Transaktionen', result.transactions], ['Diagnosen', result.diagnoses], ['Supervisionen', result.supervisions]].map(([label, val]) => (
                <div key={String(label)} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          {result.warnings.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>⚠ {result.warnings.length} Hinweise</h3>
              {result.warnings.map((w, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0' }}>· {w}</p>)}
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            <strong>Nächste Schritte:</strong> Klient:innen öffnen und Geburtsdatum + Geschlecht ergänzen (Pflichtfelder in KDS, nicht im TheraPsy-Export enthalten → wurden als Platzhalter angelegt).
          </p>
          <a href="/patients" className="btn-primary" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Zu den Klient:innen →</a>
        </div>
      )}
    </div>
  )
}
