'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, FileText, Eye, Edit3, Printer, Download, Trash2, ClipboardCheck } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = { ENTWURF: 'Entwurf', AUSGESTELLT: 'Ausgestellt' }
const STATUS_CLASS: Record<string, string> = { ENTWURF: 'badge-gray', AUSGESTELLT: 'badge-green' }

function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}

interface ConfirmationListItem {
  id: string
  titel: string
  status: 'ENTWURF' | 'AUSGESTELLT'
  datum: string
  createdAt: string
  templateId: string | null
  templateName: string | null
  sessionId: string | null
  sessionName: string | null
  hasDocument: boolean
}

export function ConfirmationsPanel({ patientId }: { patientId: string }) {
  const [confirmations, setConfirmations] = useState<ConfirmationListItem[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    templateId: '', titel: '', sessionId: '', datum: new Date().toISOString().slice(0, 10),
    inhalt: '', bemerkungen: '',
  })
  const [editingHasDocument, setEditingHasDocument] = useState(false)
  const [resettingDoc, setResettingDoc] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, tRes, sRes] = await Promise.all([
      fetch(`/api/patients/${patientId}/confirmations`).then(r => r.json()),
      fetch('/api/confirmation-templates').then(r => r.json()),
      fetch(`/api/patients/${patientId}/sessions`).then(r => r.json()),
    ])
    setConfirmations(Array.isArray(cRes) ? cRes : [])
    setTemplates(Array.isArray(tRes) ? tRes : [])
    setSessions(Array.isArray(sRes) ? sRes : [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingId(null)
    setEditingHasDocument(false)
    setError('')
    const def = templates.find(t => t.isDefault) ?? templates[0]
    setForm({
      templateId: def?.id ?? '',
      titel: def?.name ?? '',
      sessionId: '',
      datum: new Date().toISOString().slice(0, 10),
      inhalt: def?.bodyText ?? '',
      bemerkungen: '',
    })
    setShowModal(true)
  }

  async function openEdit(item: ConfirmationListItem) {
    setError('')
    const res = await fetch(`/api/patients/${patientId}/confirmations/${item.id}`)
    if (!res.ok) return
    const c = await res.json()
    setEditingId(item.id)
    setEditingHasDocument(item.hasDocument)
    setForm({
      templateId: c.templateId ?? '',
      titel: c.titel ?? '',
      sessionId: c.sessionId ?? '',
      datum: (c.datum ?? new Date().toISOString()).slice(0, 10),
      inhalt: c.inhalt ?? '',
      bemerkungen: c.bemerkungen ?? '',
    })
    setShowModal(true)
  }

  async function resetDocument() {
    if (!editingId) return
    if (!confirm('Bereits ausgestelltes Dokument verwerfen, damit beim nächsten Erzeugen die aktuellen (bearbeiteten) Daten verwendet werden?')) return
    setResettingDoc(true)
    try {
      await fetch(`/api/patients/${patientId}/confirmations/${editingId}/document`, { method: 'DELETE' })
      setEditingHasDocument(false)
    } finally {
      setResettingDoc(false)
    }
  }

  function onTemplateChange(templateId: string) {
    const t = templates.find(t => t.id === templateId)
    setForm(f => ({
      ...f,
      templateId,
      // Titel/Freitext nur übernehmen, wenn noch nichts Eigenes eingegeben wurde
      titel: f.titel ? f.titel : (t?.name ?? f.titel),
      inhalt: f.inhalt ? f.inhalt : (t?.bodyText ?? f.inhalt),
    }))
  }

  async function persist(): Promise<string | null> {
    if (!form.titel.trim()) { setError('Titel fehlt'); return null }
    setSaving(true); setError('')
    try {
      const payload = {
        templateId: form.templateId || null,
        titel: form.titel,
        sessionId: form.sessionId || null,
        datum: form.datum,
        inhalt: form.inhalt,
        bemerkungen: form.bemerkungen || null,
      }
      const res = editingId
        ? await fetch(`/api/patients/${patientId}/confirmations/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch(`/api/patients/${patientId}/confirmations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Fehler beim Speichern'); return null }
      const saved = await res.json()
      setEditingId(saved.id)
      return saved.id as string
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    const id = await persist()
    if (id) { setShowModal(false); load() }
  }

  async function handlePrintOrPdf() {
    const id = await persist()
    if (!id) return
    window.open(`/api/patients/${patientId}/confirmations/${id}/document`, '_blank')
    setShowModal(false)
    load()
  }

  async function deleteConfirmation(id: string) {
    if (!confirm('Bestätigung wirklich löschen?')) return
    await fetch(`/api/patients/${patientId}/confirmations/${id}`, { method: 'DELETE' })
    load()
  }

  const inputStyle = { className: 'input' }
  const labelStyle = { className: 'label' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={openCreate} className="btn-primary" disabled={templates.length === 0}>
          <Plus style={{ width: 13, height: 13 }} /> Neue Bestätigung
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
      ) : confirmations.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="empty-state">
            <ClipboardCheck className="empty-state-icon" style={{ width: 36, height: 36 }} />
            <p className="empty-state-text">Noch keine Bestätigungen erstellt.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr>
              <th>Titel</th><th>Vorlage</th><th>Erstellungsdatum</th><th>Sitzung</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {confirmations.map(c => (
                <tr key={c.id}>
                  <td className="primary">{c.titel}</td>
                  <td>{c.templateName ?? '—'}</td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td>{c.sessionName ?? '—'}</td>
                  <td><span className={'badge ' + STATUS_CLASS[c.status]}>{STATUS_LABEL[c.status]}</span></td>
                  <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => window.open(`/api/patients/${patientId}/confirmations/${c.id}/document`, '_blank')}
                      className="btn-ghost" style={{ padding: 5 }} title="Anzeigen">
                      <Eye style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => openEdit(c)} className="btn-ghost" style={{ padding: 5 }} title="Bearbeiten">
                      <Edit3 style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => window.open(`/api/patients/${patientId}/confirmations/${c.id}/document`, '_blank')}
                      className="btn-ghost" style={{ padding: 5 }} title="PDF herunterladen">
                      <Download style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => window.open(`/api/patients/${patientId}/confirmations/${c.id}/document`, '_blank')}
                      className="btn-ghost" style={{ padding: 5 }} title="Drucken">
                      <Printer style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => deleteConfirmation(c.id)} className="btn-ghost" style={{ padding: 5, color: 'var(--red)' }} title="Löschen">
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Neue / Bearbeiten Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15 }}>{editingId ? 'Bestätigung bearbeiten' : 'Neue Bestätigung'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {error && (
                <div style={{ padding: '8px 12px', background: 'var(--red-bg)', border: '0.5px solid var(--red-border)', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
                  {error}
                </div>
              )}
              {editingHasDocument && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-warning-light, #fff7e6)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  <span style={{ flex: 1 }}>
                    Diese Bestätigung wurde bereits als Dokument ausgestellt und ist eingefroren. Änderungen hier
                    wirken sich erst aus, wenn das bestehende Dokument zurückgesetzt wird.
                  </span>
                  <button onClick={resetDocument} disabled={resettingDoc} className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                    {resettingDoc ? 'Setze zurück…' : 'Dokument zurücksetzen'}
                  </button>
                </div>
              )}
              <div>
                <label {...labelStyle}>Vorlage</label>
                <select {...inputStyle} value={form.templateId} onChange={e => onTemplateChange(e.target.value)}>
                  <option value="">— Keine Vorlage —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label {...labelStyle}>Titel *</label>
                <input {...inputStyle} value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div>
                  <label {...labelStyle}>Sitzung (optional)</label>
                  <select {...inputStyle} value={form.sessionId} onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}>
                    <option value="">— Keine —</option>
                    {sessions.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label {...labelStyle}>Datum</label>
                  <input type="date" {...inputStyle} value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
                </div>
              </div>
              <div>
                <label {...labelStyle}>Freitext</label>
                <textarea
                  value={form.inhalt}
                  onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                  style={{ width: '100%', minHeight: 130, padding: '8px 10px', fontSize: 13, resize: 'vertical', border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--surface-page)', color: 'var(--text-primary)', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
                  placeholder="z.B. Hiermit wird bestätigt, dass {{patient_name}} am {{sitzungsdatum}}…"
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Platzhalter wie <code>{'{{patient_name}}'}</code> oder <code>{'{{sitzungsdatum}}'}</code> werden beim Erzeugen automatisch ersetzt.
                </div>
              </div>
              <div>
                <label {...labelStyle}>Zusätzliche Bemerkungen (intern, erscheinen nicht im Dokument)</label>
                <textarea
                  value={form.bemerkungen}
                  onChange={e => setForm(f => ({ ...f, bemerkungen: e.target.value }))}
                  style={{ width: '100%', minHeight: 60, padding: '8px 10px', fontSize: 13, resize: 'vertical', border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--surface-page)', color: 'var(--text-primary)', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Abbrechen</button>
              <button onClick={handleSave} disabled={saving} className="btn-secondary">
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button onClick={handlePrintOrPdf} disabled={saving} className="btn-secondary">
                <FileText style={{ width: 13, height: 13 }} /> PDF erzeugen
              </button>
              <button onClick={handlePrintOrPdf} disabled={saving} className="btn-primary" style={{ marginLeft: 'auto' }}>
                <Printer style={{ width: 13, height: 13 }} /> Drucken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
