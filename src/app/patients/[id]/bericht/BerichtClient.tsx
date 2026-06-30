'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, FileText, Printer, Loader, AlertCircle, Eye, History, Trash2, Lock } from 'lucide-react'

type ReportType = 'therapiebericht' | 'arztbrief' | 'verlaufsbericht'

interface ArchivedReport {
  id: string
  reportType: string
  reportTypeLabel: string
  createdByName: string
  anonymized: boolean
  createdAt: string
}

const REPORT_TYPES: { key: ReportType; label: string; desc: string; icon: string }[] = [
  {
    key: 'therapiebericht',
    label: 'Therapiebericht',
    desc: 'Für Krankenkasse, Versicherung oder Gutachter. Enthält Diagnosen, Behandlungsverlauf, Epikrise und aktuellen Stand.',
    icon: '📋',
  },
  {
    key: 'arztbrief',
    label: 'Ärztlicher Bericht / Arztbrief',
    desc: 'Für Hausarzt oder Facharzt. Kurze, datensparsame Zusammenfassung mit Diagnose und Empfehlung (gem. §16a PTG).',
    icon: '✉️',
  },
  {
    key: 'verlaufsbericht',
    label: 'Verlaufsbericht',
    desc: 'Interne Dokumentation aller Sitzungen mit Protokollen, Testergebnissen und Therapieverlauf.',
    icon: '📈',
  },
]

const INP = {
  style: {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '0.5px solid var(--border)', borderRadius: 7,
    background: 'var(--surface-page)', color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  }
}
const TA = {
  style: {
    width: '100%', padding: '8px 10px', fontSize: 13, resize: 'vertical' as const, minHeight: 90,
    border: '0.5px solid var(--border)', borderRadius: 7,
    background: 'var(--surface-page)', color: 'var(--text-primary)',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', lineHeight: 1.5,
  }
}
const LBL = { style: { fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)', display: 'block', marginBottom: 4 } }
const SEC = { style: { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' } }

export function BerichtClient({
  patient, therapistName, firstSessionDate, lastSessionDate, totalSessions,
}: {
  patient: any
  therapistName: string
  firstSessionDate: string | null
  lastSessionDate: string | null
  totalSessions: number
}) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [reportType, setReportType] = useState<ReportType>('therapiebericht')
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')

  const [archive, setArchive] = useState<ArchivedReport[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)

  async function loadArchive() {
    setArchiveLoading(true)
    try {
      const res = await fetch(`/api/patients/${patient.id}/bericht/archiv`)
      if (res.ok) setArchive(await res.json())
    } catch { /* ignore */ }
    setArchiveLoading(false)
  }

  useEffect(() => { loadArchive() }, [])

  async function deleteArchived(docId: string) {
    if (!confirm('Diesen archivierten Bericht wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    try {
      await fetch(`/api/patients/${patient.id}/bericht/archiv/${docId}`, { method: 'DELETE' })
      setArchive(a => a.filter(d => d.id !== docId))
    } catch { /* ignore */ }
  }

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    // Empfänger
    adressat: '',
    adressatTitel: '',
    adressatAdresse: '',
    // Zeitraum
    zeitraumVon: firstSessionDate?.slice(0, 10) ?? '',
    zeitraumBis: today,
    // Einschluss
    includeAnamnese: true,
    includeSessions: true,
    includeAssessments: true,
    includeGoals: true,
    anonymize: false,
    // Freitext
    anamnese: '',
    therapiemethode: '',
    verlauf: '',
    status: '',
    empfehlung: '',
  })

  const backUrl = `/patients/${patient.id}?tab=klinik`
  const patName = `${patient.firstName} ${patient.lastName}`

  function upd(k: keyof typeof form, v: any) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function generate(openPrint = false) {
    setGenerating(true); setError('')
    try {
      const res = await fetch(`/api/patients/${patient.id}/bericht`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          adressat: form.adressat,
          adressatTitel: form.adressatTitel,
          adressatAdresse: form.adressatAdresse,
          zeitraumVon: form.zeitraumVon || null,
          zeitraumBis: form.zeitraumBis || null,
          includeAnamnese: form.includeAnamnese,
          includeSessions: form.includeSessions,
          includeAssessments: form.includeAssessments,
          includeGoals: form.includeGoals,
          anonymize: form.anonymize,
          freitext: {
            anamnese:       form.anamnese,
            therapiemethode: form.therapiemethode,
            verlauf:         form.verlauf,
            status:          form.status,
            empfehlung:      form.empfehlung,
          },
          // Nur beim echten Drucken/PDF wird ein unveränderliches Archiv-Exemplar
          // angelegt - die Vorschau bleibt ein reiner, nicht gespeicherter Entwurf
          finalize: openPrint,
        }),
      })
      if (!res.ok) throw new Error(`Fehler ${res.status}`)
      const html = await res.text()
      if (openPrint) {
        const w = window.open('', '_blank')
        if (w) { w.document.write(html); w.document.close() }
        loadArchive()
      } else {
        setPreviewHtml(html)
        setShowPreview(true)
      }
    } catch (e: any) {
      setError(e.message)
    }
    setGenerating(false)
  }

  // iFrame updaten
  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open(); doc.write(previewHtml); doc.close()
  }, [previewHtml])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push(backUrl)} className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück zur Akte
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{patName}</span>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Bericht erstellen</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{error}</span>}
          <button onClick={() => generate(false)} disabled={generating} className="btn-secondary" style={{ fontSize: 13 }}>
            <Eye style={{ width: 13, height: 13 }} /> Vorschau
          </button>
          <button onClick={() => generate(true)} disabled={generating} className="btn-primary" style={{ fontSize: 13 }}>
            {generating ? <><Loader style={{ width: 13, height: 13 }} /> Generiere...</> : <><Printer style={{ width: 13, height: 13 }} /> Drucken / PDF</>}
          </button>
        </div>
      </div>

      {/* Zweispalten */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Editor */}
        <div style={{ width: showPreview ? 400 : '100%', flexShrink: 0, overflowY: 'auto', padding: 24, background: 'var(--surface-page)', borderRight: showPreview ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Berichtstyp */}
            <div>
              <div {...SEC}>Berichtstyp</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REPORT_TYPES.map(rt => (
                  <label key={rt.key} style={{
                    display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${reportType === rt.key ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: reportType === rt.key ? 'var(--color-primary-light)' : 'var(--surface-card)',
                    alignItems: 'flex-start',
                  }}>
                    <input type="radio" name="reportType" value={rt.key} checked={reportType === rt.key}
                      onChange={() => setReportType(rt.key)} style={{ marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rt.icon} {rt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{rt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Bisherige Berichte (unveränderliches Archiv) */}
            <div>
              <div {...SEC}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History style={{ width: 13, height: 13 }} /> Bisherige Berichte
                </span>
              </div>
              {archiveLoading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 2px' }}>Lade…</div>
              ) : archive.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 2px' }}>
                  Noch keine Berichte ausgestellt. Beim Klick auf "Drucken / PDF" wird ein unveränderliches Exemplar archiviert.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {archive.map(doc => (
                    <div key={doc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      background: 'var(--surface-card)', borderRadius: 8, border: '0.5px solid var(--border)',
                    }}>
                      <span title="Unveränderlich archiviert" style={{ display: 'inline-flex', flexShrink: 0 }}>
                        <Lock style={{ width: 13, height: 13, color: 'var(--text-muted)' }} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {doc.reportTypeLabel}
                          {doc.anonymized && (
                            <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 4 }}>
                              anonymisiert
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(doc.createdAt).toLocaleDateString('de-AT', { dateStyle: 'medium' })} · {new Date(doc.createdAt).toLocaleTimeString('de-AT', { timeStyle: 'short' })} · {doc.createdByName}
                        </div>
                      </div>
                      <button
                        onClick={() => window.open(`/api/patients/${patient.id}/bericht/archiv/${doc.id}`, '_blank')}
                        className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11.5, flexShrink: 0 }}
                      >
                        Öffnen
                      </button>
                      <button
                        onClick={() => deleteArchived(doc.id)}
                        className="btn-ghost" style={{ padding: 5, color: 'var(--red)', flexShrink: 0 }}
                        title="Aus Archiv löschen"
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Empfänger (nur bei Arztbrief / Therapiebericht) */}
            {(reportType === 'arztbrief' || reportType === 'therapiebericht') && (
              <div>
                <div {...SEC}>Empfänger</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
                    <div>
                      <label {...LBL}>Titel</label>
                      <input {...INP} value={form.adressatTitel} onChange={e => upd('adressatTitel', e.target.value)} placeholder="Dr." />
                    </div>
                    <div>
                      <label {...LBL}>Name *</label>
                      <input {...INP} value={form.adressat} onChange={e => upd('adressat', e.target.value)} placeholder="Vorname Nachname" />
                    </div>
                  </div>
                  <div>
                    <label {...LBL}>Adresse</label>
                    <textarea {...TA} style={{ ...TA.style, minHeight: 60 }} value={form.adressatAdresse}
                      onChange={e => upd('adressatAdresse', e.target.value)} placeholder="Straße, PLZ Ort" />
                  </div>
                </div>
              </div>
            )}

            {/* Zeitraum */}
            <div>
              <div {...SEC}>Behandlungszeitraum</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label {...LBL}>Von</label>
                  <input type="date" {...INP} value={form.zeitraumVon} onChange={e => upd('zeitraumVon', e.target.value)} />
                </div>
                <div>
                  <label {...LBL}>Bis</label>
                  <input type="date" {...INP} value={form.zeitraumBis} onChange={e => upd('zeitraumBis', e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                Patient hat {totalSessions} Sitzungen gesamt{firstSessionDate ? ` (erste: ${new Date(firstSessionDate).toLocaleDateString('de-AT')})` : ''}.
              </div>
            </div>

            {/* Einschluss */}
            <div>
              <div {...SEC}>Inhalte einschließen</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: 'includeAnamnese', label: 'Anamnese' },
                  { key: 'includeSessions', label: 'Sitzungsübersicht' },
                  { key: 'includeAssessments', label: 'Diagnostische Befunde / Testverfahren' },
                  { key: 'includeGoals', label: 'Therapieziele' },
                ].map(item => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-card)', borderRadius: 7 }}>
                    <input type="checkbox" checked={(form as any)[item.key]}
                      onChange={e => upd(item.key as any, e.target.checked)} />
                    {item.label}
                  </label>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-card)', borderRadius: 7, borderLeft: '2px solid var(--amber)' }}>
                  <input type="checkbox" checked={form.anonymize}
                    onChange={e => upd('anonymize', e.target.checked)} />
                  <span>Anonymisieren (nur Initialen statt Klarname)</span>
                </label>
              </div>
            </div>

            {/* Freitext-Felder */}
            <div>
              <div {...SEC}>Inhalt (vorausgefüllt aus Patientendaten, editierbar)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {form.includeAnamnese && (
                  <div>
                    <label {...LBL}>Anamnese <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leer = automatisch aus Patientenakte)</span></label>
                    <textarea {...TA} value={form.anamnese} onChange={e => upd('anamnese', e.target.value)}
                      placeholder="Anamnestische Angaben zur Vorgeschichte, Beschwerden, Auslöser…" />
                  </div>
                )}

                <div>
                  <label {...LBL}>Therapiemethode &amp; Rahmenbedingungen *</label>
                  <textarea {...TA} value={form.therapiemethode} onChange={e => upd('therapiemethode', e.target.value)}
                    placeholder="z.B. Ambulante Einzelpsychotherapie, tiefenpsychologisch fundiert, wöchentlich 50 min…" />
                </div>

                <div>
                  <label {...LBL}>Behandlungsverlauf / Epikrise *</label>
                  <textarea {...TA} style={{ ...TA.style, minHeight: 140 }} value={form.verlauf} onChange={e => upd('verlauf', e.target.value)}
                    placeholder="Zusammenfassung des Therapieverlaufs, Hauptthemen, therapeutische Interventionen, Fortschritte und Herausforderungen…" />
                </div>

                <div>
                  <label {...LBL}>Aktueller Behandlungsstand *</label>
                  <textarea {...TA} value={form.status} onChange={e => upd('status', e.target.value)}
                    placeholder="Aktueller psychischer Status, Stimmungslage, Symptomatik, Ressourcen…" />
                </div>

                {reportType === 'arztbrief' && (
                  <div>
                    <label {...LBL}>Empfehlung</label>
                    <textarea {...TA} value={form.empfehlung} onChange={e => upd('empfehlung', e.target.value)}
                      placeholder="z.B. Weiterführung der ambulanten Psychotherapie, medikamentöse Abklärung, fachärztliche Untersuchung…" />
                  </div>
                )}
              </div>
            </div>

            {/* Datenschutz-Hinweis */}
            <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>§16a Psychotherapiegesetz (AT):</strong> Berichte dürfen nur mit schriftlicher Einwilligung des Patienten weitergegeben werden.
              Aufbewahrungspflicht: 10 Jahre nach Therapieende. Patienten haben Einsichts- und Kopierrecht.
            </div>

          </div>
        </div>

        {/* Vorschau-Panel */}
        {showPreview && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Vorschau</span>
              <button onClick={() => setShowPreview(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>✕ Schließen</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', justifyContent: 'center' }}>
              <iframe ref={iframeRef} style={{ width: '210mm', minHeight: '297mm', background: 'white', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 4 }} title="Berichts-Vorschau" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
