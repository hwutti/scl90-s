'use client'
import { useState, useEffect, useCallback } from 'react'
import { Save, ChevronDown, ChevronUp, Lock, FileText, CheckCircle } from 'lucide-react'

type ProtocolType = 'SHORT' | 'LONG'

// ── Spec-konforme Standardfelder (KDS-SCR-01A / 01B) ─────────────────────────

const DEFAULT_SHORT_SECTIONS = [
  { title: 'Thema der Stunde',           content: '' },
  { title: 'Verstehenshypothese',         content: '' },
  { title: 'Therapeutische Intervention', content: '' },
  { title: 'Therapeutische Ziele',        content: '' },
  { title: 'Supervision',                 content: '' },
  { title: 'Sonstiges',                   content: '' },
]

const DEFAULT_LONG_SECTIONS = [
  { title: 'Stimmung vor der Stunde',                content: '' },
  { title: 'Hauptthemen',                            content: '' },
  { title: 'Beziehung zwischen Klient*in und Therapeut*in', content: '' },
  { title: 'Resonanzen',                             content: '' },
  { title: 'Aktuelle Verstehenshypothese',           content: '' },
  { title: 'Hauptintervention und ihr Schicksal',    content: '' },
  { title: 'Atmosphäre am Ende der Stunde',          content: '' },
  { title: 'Sonstiges',                              content: '' },
]

interface Props {
  sessionId: string
  type: ProtocolType
  readOnly?: boolean
  // Wenn true: Langprotokoll wird nur für ADMIN/THERAPIST angezeigt
  role?: string
}

export function ProtocolEditor({ sessionId, type, readOnly = false, role }: Props) {
  const [sections, setSections] = useState<{ title: string; content: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Rollenberechtigung für Langprotokoll
  const isLong = type === 'LONG'
  const hasLongAccess = !isLong || role === 'ADMIN' || role === 'THERAPIST'

  const load = useCallback(async () => {
    if (!hasLongAccess) return
    setLoading(true)
    try {
      const data = await fetch(`/api/therapy-sessions/${sessionId}/protocol?type=${type}`).then(r => r.json())
      if (data?.sections?.length) {
        setSections(data.sections)
      } else {
        setSections(type === 'SHORT' ? DEFAULT_SHORT_SECTIONS : DEFAULT_LONG_SECTIONS)
      }
    } catch {
      setSections(type === 'SHORT' ? DEFAULT_SHORT_SECTIONS : DEFAULT_LONG_SECTIONS)
    } finally {
      setLoading(false)
    }
  }, [sessionId, type, hasLongAccess])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await fetch(`/api/therapy-sessions/${sessionId}/protocol`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sections }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const label = isLong ? 'Langprotokoll' : 'Kurzprotokoll'
  const color = isLong ? 'var(--amber)' : 'var(--color-primary)'
  const bg    = isLong ? 'var(--amber-bg)' : 'var(--color-primary-light)'

  return (
    <div style={{ border: `1px solid ${isLong ? 'var(--amber-border,#fcd34d)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: bg, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <FileText style={{ width: 14, height: 14, stroke: color, fill: 'none', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color, flex: 1 }}>{label}</span>
        {isLong && <span title="Nur für Therapeut*in sichtbar" style={{ display: 'flex' }}><Lock style={{ width: 12, height: 12, stroke: color, fill: 'none' }} /></span>}
        {saved && <CheckCircle style={{ width: 13, height: 13, stroke: 'var(--green)', fill: 'none' }} />}
        {collapsed
          ? <ChevronDown style={{ width: 14, height: 14, stroke: color }} />
          : <ChevronUp   style={{ width: 14, height: 14, stroke: color }} />
        }
      </div>

      {!collapsed && (
        <div style={{ padding: 14, background: 'var(--surface-card)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Zugriffssperre für Langprotokoll */}
          {!hasLongAccess ? (
            <div style={{ padding: '12px 14px', background: 'var(--amber-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--amber)' }}>
              <Lock style={{ width: 14, height: 14, flexShrink: 0 }} />
              Das Langprotokoll ist nur für Therapeut*innen sichtbar.
            </div>
          ) : loading ? (
            <div className="empty-state"><div className="spinner" style={{ width: 20, height: 20 }} /></div>
          ) : (
            <>
              {/* 2-Spalten-Grid für die Felder */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}>
                {sections.map((sec, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {sec.title}
                    </label>
                    <textarea
                      readOnly={readOnly}
                      value={sec.content}
                      onChange={e => {
                        if (readOnly) return
                        const updated = [...sections]
                        updated[i] = { ...updated[i], content: e.target.value }
                        setSections(updated)
                      }}
                      placeholder={readOnly ? '' : `${sec.title} ...`}
                      rows={4}
                      style={{
                        width: '100%', resize: 'vertical', padding: '7px 9px',
                        border: '0.5px solid var(--border-strong)', borderRadius: 7,
                        background: readOnly ? 'var(--surface-panel)' : 'var(--surface-input)',
                        color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6,
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                        flex: 1,
                      }}
                      onFocus={e => !readOnly && (e.target.style.borderColor = color)}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
                    />
                  </div>
                ))}
              </div>

              {!readOnly && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 12 }}>
                    {saving ? (
                      <><div className="spinner" style={{ width: 12, height: 12 }} /> Speichern...</>
                    ) : saved ? (
                      <><CheckCircle style={{ width: 12, height: 12 }} /> Gespeichert</>
                    ) : (
                      <><Save style={{ width: 12, height: 12 }} /> Protokoll speichern</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
