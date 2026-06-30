'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Save, Star, Copy, Eye,
  Code, Sliders, RefreshCw, FileText, Check, AlertCircle, ChevronRight,
} from 'lucide-react'

const REPORT_TYPE_LABELS: Record<string, string> = {
  all:             'Alle Typen',
  therapiebericht: 'Therapiebericht',
  arztbrief:       'Arztbrief',
  verlaufsbericht: 'Verlaufsbericht',
}
const FONT_OPTIONS = [
  { value: 'Times New Roman, serif', label: 'Times New Roman (Standard)' },
  { value: 'Arial, sans-serif',      label: 'Arial' },
  { value: 'Georgia, serif',         label: 'Georgia' },
  { value: 'Helvetica Neue, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Garamond, serif',        label: 'Garamond' },
]

interface GuiFields {
  primaryColor: string; fontFamily: string; fontSize: string
  praxisName: string; praxisAddress: string; praxisPhone: string; praxisEmail: string
  taxNumber: string; vatId: string; footerText: string
  showPageNumbers: boolean; showDataProtection: boolean
  headerImageBase64: string; headerImageMime: string
  footerImageBase64: string; footerImageMime: string
  bgImageBase64: string; bgImageMime: string
  bgImageOpacity: number; bgImageMode: string
}

const EMPTY_GUI: GuiFields = {
  primaryColor: '#1a1a2e', fontFamily: 'Times New Roman, serif', fontSize: '11pt',
  praxisName: '', praxisAddress: '', praxisPhone: '', praxisEmail: '',
  taxNumber: '', vatId: '', footerText: '', showPageNumbers: true, showDataProtection: true,
  headerImageBase64: '', headerImageMime: '', footerImageBase64: '', footerImageMime: '',
  bgImageBase64: '', bgImageMime: '', bgImageOpacity: 0.06, bgImageMode: 'behind',
}

function templateToGui(t: any): GuiFields {
  return {
    primaryColor:      t.primaryColor      ?? '#1a1a2e',
    fontFamily:        t.fontFamily        ?? 'Times New Roman, serif',
    fontSize:          t.fontSize          ?? '11pt',
    praxisName:        t.praxisName        ?? '',
    praxisAddress:     t.praxisAddress     ?? '',
    praxisPhone:       t.praxisPhone       ?? '',
    praxisEmail:       t.praxisEmail       ?? '',
    taxNumber:         t.taxNumber         ?? '',
    vatId:             t.vatId             ?? '',
    footerText:        t.footerText        ?? '',
    showPageNumbers:   t.showPageNumbers   ?? true,
    showDataProtection:t.showDataProtection ?? true,
    headerImageBase64: t.headerImageBase64  ?? '',
    headerImageMime:   t.headerImageMime    ?? '',
    footerImageBase64: t.footerImageBase64  ?? '',
    footerImageMime:   t.footerImageMime    ?? '',
    bgImageBase64:     t.bgImageBase64      ?? '',
    bgImageMime:       t.bgImageMime        ?? '',
    bgImageOpacity:    t.bgImageOpacity     ?? 0.06,
    bgImageMode:       t.bgImageMode        ?? 'behind',
  }
}

const MAX_DIMS: Record<string, { w: number; h: number }> = {
  headerImage: { w: 2480, h: 400 },
  footerImage:  { w: 2480, h: 300 },
  bgImage:      { w: 1240, h: 1754 },
}

export function BerichtsvorlageClient({ templates: initialTemplates, defaultHtml }: {
  templates: any[]; defaultHtml: string
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [activeId, setActiveId] = useState<string | null>(initialTemplates[0]?.id ?? null)
  const active = templates.find(t => t.id === activeId) ?? null

  const [editorMode, setEditorMode] = useState<'gui' | 'html'>('gui')
  const [gui, setGui] = useState<GuiFields>(active ? templateToGui(active) : EMPTY_GUI)
  const [htmlContent, setHtmlContent] = useState(active?.htmlContent ?? defaultHtml)
  const [templateName, setTemplateName] = useState(active?.name ?? '')
  const [templateDesc, setTemplateDesc] = useState(active?.description ?? '')
  const [reportType, setReportType] = useState(active?.reportType ?? 'all')

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!active) return
    setGui(templateToGui(active))
    setHtmlContent(active.htmlContent ?? defaultHtml)
    setTemplateName(active.name)
    setTemplateDesc(active.description ?? '')
    setReportType(active.reportType ?? 'all')
    setDirty(false)
  }, [activeId])

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/admin/report-templates/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: editorMode === 'html' ? htmlContent : undefined,
          templateId: activeId,
          guiFields: gui,
          editorMode,
        }),
      })
      const data = await res.json()
      setPreviewHtml(data.html ?? '')
    } catch { /* ignore */ }
    setPreviewLoading(false)
  }, [htmlContent, gui, editorMode, activeId])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(refreshPreview, 600)
    return () => clearTimeout(debounceRef.current)
  }, [refreshPreview])

  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open(); doc.write(previewHtml); doc.close()
  }, [previewHtml])

  function markDirty() { setDirty(true); setSaved(false) }
  function updateGui(field: keyof GuiFields, value: any) { setGui(g => ({ ...g, [field]: value })); markDirty() }

  // Bild-Upload mit Komprimierung
  function handleImageUpload(field: 'headerImage' | 'footerImage' | 'bgImage', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isSvg = file.type === 'image/svg+xml' || file.type === 'application/pdf'
    if (isSvg) {
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1]
        updateGui(`${field}Base64` as keyof GuiFields, b64)
        updateGui(`${field}Mime` as keyof GuiFields, file.type)
      }
      reader.readAsDataURL(file); return
    }
    const { w: maxW, h: maxH } = MAX_DIMS[field]
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxW || height > maxH) {
        const r = Math.min(maxW / width, maxH / height)
        width = Math.round(width * r); height = Math.round(height * r)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const b64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
      updateGui(`${field}Base64` as keyof GuiFields, b64)
      updateGui(`${field}Mime` as keyof GuiFields, 'image/jpeg')
    }
    img.src = url
  }
  function clearImage(field: 'headerImage' | 'footerImage' | 'bgImage') {
    updateGui(`${field}Base64` as keyof GuiFields, '')
    updateGui(`${field}Mime` as keyof GuiFields, '')
  }

  async function save() {
    if (!activeId) return
    setSaving(true); setError('')
    try {
      const body: any = { name: templateName, description: templateDesc, reportType, ...gui }
      if (editorMode === 'html') body.htmlContent = htmlContent
      const res = await fetch(`/api/admin/report-templates/${activeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      let updated: any
      try { updated = await res.json() } catch { throw new Error(`Server-Fehler (${res.status})`) }
      if (!res.ok) throw new Error(updated?.error ?? `Fehler ${res.status}`)
      setTemplates(ts => ts.map(t => t.id === activeId ? { ...t, ...updated } : t))
      setSaved(true); setDirty(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function createNew() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/report-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Neue Vorlage', reportType: 'all', isDefault: templates.length === 0, ...EMPTY_GUI }),
      })
      const t = await res.json()
      setTemplates(ts => [t, ...ts]); setActiveId(t.id)
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function duplicate() {
    if (!active) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/report-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${active.name} (Kopie)`, reportType: active.reportType, isDefault: false, duplicateFrom: active.id }),
      })
      const t = await res.json()
      setTemplates(ts => [t, ...ts]); setActiveId(t.id)
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function setDefault() {
    if (!activeId) return
    await fetch(`/api/admin/report-templates/${activeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true, reportType }),
    })
    setTemplates(ts => ts.map(t => ({
      ...t, isDefault: t.id === activeId && t.reportType === reportType ? true : t.reportType === reportType ? false : t.isDefault
    })))
  }

  async function resetToAutoLayout() {
    if (!activeId) return
    if (!confirm('Eigene HTML-Anpassungen verwerfen und auf das automatische Standard-Layout zurücksetzen?')) return
    try {
      const res = await fetch(`/api/admin/report-templates/${activeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToAuto: true }),
      })
      const updated = await res.json()
      setTemplates(ts => ts.map(t => t.id === activeId ? { ...t, ...updated } : t))
      setEditorMode('gui')
    } catch { /* ignore */ }
  }

  async function deleteTemplate() {
    if (!activeId || !confirm('Vorlage wirklich löschen?')) return
    await fetch(`/api/admin/report-templates/${activeId}`, { method: 'DELETE' })
    const remaining = templates.filter(t => t.id !== activeId)
    setTemplates(remaining); setActiveId(remaining[0]?.id ?? null)
  }

  const inp = { style: { width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)', boxSizing: 'border-box' as const } }
  const lbl = { style: { fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)', display: 'block', marginBottom: 4 } }
  const sec = { style: { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' } }

  const ImageUpload = ({ field, label, maxH, hint }: { field: 'headerImage'|'footerImage'|'bgImage', label: string, maxH: number, hint: string }) => {
    const b64 = gui[`${field}Base64` as keyof GuiFields] as string
    const mime = gui[`${field}Mime` as keyof GuiFields] as string
    return (
      <div>
        <label {...lbl}>{label}</label>
        {b64 ? (
          <div style={{ position: 'relative', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <img src={`data:${mime};base64,${b64}`} style={{ width: '100%', maxHeight: maxH, objectFit: 'cover', display: 'block' }} alt="" />
            <button onClick={() => clearImage(field)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>✕</button>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" style={{ display: 'none' }} onChange={e => handleImageUpload(field, e)} />
            📁 PNG, JPG, SVG oder PDF
          </label>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push('/admin/settings')} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Administration
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Berichtsvorlage</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{error}</span>}
          {dirty && !saved && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ungespeichert</span>}
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><Check style={{ width: 13, height: 13 }} />Gespeichert</span>}
          <button onClick={save} disabled={saving || !activeId} className="btn-primary" style={{ fontSize: 13 }}>
            <Save style={{ width: 13, height: 13 }} />{saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Vorlagen-Liste */}
        <div style={{ width: 220, flexShrink: 0, background: 'var(--surface-card)', borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Vorlagen</span>
            <button onClick={createNew} className="btn-ghost" style={{ padding: 4 }} title="Neue Vorlage"><Plus style={{ width: 15, height: 15 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {Object.entries(REPORT_TYPE_LABELS).filter(([k]) => k !== 'all').map(([type, typeLabel]) => {
              const group = templates.filter(t => t.reportType === type || t.reportType === 'all')
              return group.length === 0 ? null : (
                <div key={type}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 14px 4px' }}>{typeLabel}</div>
                  {group.map(t => (
                    <button key={t.id} onClick={() => setActiveId(t.id)} style={{
                      width: '100%', textAlign: 'left', padding: '8px 14px',
                      background: t.id === activeId ? 'var(--color-primary-light)' : 'none',
                      border: 'none', borderLeft: t.id === activeId ? '2px solid var(--color-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.id === activeId ? 'var(--color-primary)' : 'var(--text-primary)' }}>{t.name}</span>
                        {t.isDefault && <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>Standard</span>}
                      </div>
                      {t.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                    </button>
                  ))}
                </div>
              )
            })}
            {templates.filter(t => t.reportType === 'all').map(t => (
              <button key={t.id} onClick={() => setActiveId(t.id)} style={{
                width: '100%', textAlign: 'left', padding: '8px 14px',
                background: t.id === activeId ? 'var(--color-primary-light)' : 'none',
                border: 'none', borderLeft: t.id === activeId ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.id === activeId ? 'var(--color-primary)' : 'var(--text-primary)' }}>{t.name}</span>
                  {t.isDefault && <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>Standard</span>}
                </div>
              </button>
            ))}
            {templates.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                <button onClick={createNew} className="btn-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                  <Plus style={{ width: 13, height: 13 }} /> Erste erstellen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div style={{ width: 380, flexShrink: 0, background: 'var(--surface-page)', borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!active ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <FileText style={{ width: 40, height: 40, color: 'var(--text-muted)', opacity: 0.3 }} />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Keine Vorlage ausgewählt</span>
              <button onClick={createNew} className="btn-primary" style={{ fontSize: 13 }}><Plus style={{ width: 14, height: 14 }} /> Erstellen</button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setEditorMode('gui')} className={editorMode === 'gui' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 12, padding: '5px 10px' }}>
                  <Sliders style={{ width: 13, height: 13 }} /> Einfach
                </button>
                <button onClick={() => setEditorMode('html')} className={editorMode === 'html' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 12, padding: '5px 10px' }}>
                  <Code style={{ width: 13, height: 13 }} /> HTML
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {!active.isDefault && <button onClick={setDefault} className="btn-ghost" style={{ padding: 5 }} title="Als Standard"><Star style={{ width: 13, height: 13 }} /></button>}
                  <button onClick={duplicate} className="btn-ghost" style={{ padding: 5 }} title="Duplizieren"><Copy style={{ width: 13, height: 13 }} /></button>
                  {!active.isDefault && <button onClick={deleteTemplate} className="btn-ghost" style={{ padding: 5, color: 'var(--red)' }} title="Löschen"><Trash2 style={{ width: 13, height: 13 }} /></button>}
                </div>
              </div>

              {active.customHtml ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'var(--color-warning-light, #fff7e6)', borderBottom: '0.5px solid var(--border)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <AlertCircle style={{ width: 13, height: 13, flexShrink: 0, color: '#b8860b' }} />
                  <span style={{ flex: 1 }}>Eigene HTML-Anpassung aktiv – Layout-Updates werden nicht automatisch übernommen.</span>
                  <button onClick={resetToAutoLayout} className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}>Zurücksetzen</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: '0.5px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <Check style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--green, #16a34a)' }} />
                  <span>Layout wird automatisch aktuell gehalten</span>
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {/* Name + Typ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <div><label {...lbl}>Vorlagenname</label>
                    <input {...inp} value={templateName} onChange={e => { setTemplateName(e.target.value); markDirty() }} /></div>
                  <div><label {...lbl}>Berichtstyp</label>
                    <select {...inp} value={reportType} onChange={e => { setReportType(e.target.value); markDirty() }}>
                      {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select></div>
                  <div><label {...lbl}>Beschreibung</label>
                    <input {...inp} value={templateDesc} onChange={e => { setTemplateDesc(e.target.value); markDirty() }} placeholder="z.B. Für Krankenkasse" /></div>
                </div>

                {editorMode === 'gui' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Design */}
                    <div><div {...sec}>Design</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div><label {...lbl}>Hauptfarbe</label>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="color" value={gui.primaryColor} onChange={e => updateGui('primaryColor', e.target.value)}
                                style={{ width: 36, height: 34, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                              <input {...inp} style={{ ...inp.style, flex: 1 }} value={gui.primaryColor} onChange={e => updateGui('primaryColor', e.target.value)} />
                            </div></div>
                          <div><label {...lbl}>Schriftgröße</label>
                            <select {...inp} value={gui.fontSize} onChange={e => updateGui('fontSize', e.target.value)}>
                              {['9pt','10pt','10.5pt','11pt','11.5pt','12pt'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select></div>
                        </div>
                        <div><label {...lbl}>Schriftart</label>
                          <select {...inp} value={gui.fontFamily} onChange={e => updateGui('fontFamily', e.target.value)}>
                            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select></div>
                      </div>
                    </div>

                    {/* Praxisdaten */}
                    <div><div {...sec}>Praxisdaten im Bericht</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div><label {...lbl}>Praxisname (leer = aus Branding)</label>
                          <input {...inp} value={gui.praxisName} placeholder="Automatisch aus Branding" onChange={e => updateGui('praxisName', e.target.value)} /></div>
                        <div><label {...lbl}>Adresse</label>
                          <textarea style={{ ...inp.style, minHeight: 56, resize: 'vertical' }} value={gui.praxisAddress} onChange={e => updateGui('praxisAddress', e.target.value)} placeholder="Musterstraße 1&#10;1010 Wien" /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div><label {...lbl}>Telefon</label><input {...inp} value={gui.praxisPhone} onChange={e => updateGui('praxisPhone', e.target.value)} /></div>
                          <div><label {...lbl}>E-Mail</label><input {...inp} value={gui.praxisEmail} onChange={e => updateGui('praxisEmail', e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div><label {...lbl}>Steuernummer</label><input {...inp} value={gui.taxNumber} placeholder="123/4567" onChange={e => updateGui('taxNumber', e.target.value)} /></div>
                          <div><label {...lbl}>UID-Nummer</label><input {...inp} value={gui.vatId} placeholder="ATU12345678" onChange={e => updateGui('vatId', e.target.value)} /></div>
                        </div>
                      </div>
                    </div>

                    {/* Optionen */}
                    <div><div {...sec}>Optionen</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { key: 'showDataProtection', label: 'Datenschutz-Hinweis gem. §16a PTG anzeigen' },
                          { key: 'showPageNumbers', label: 'Seitenzahlen anzeigen' },
                        ].map(opt => (
                          <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-panel)', borderRadius: 7 }}>
                            <input type="checkbox" checked={gui[opt.key as keyof GuiFields] as boolean} onChange={e => updateGui(opt.key as keyof GuiFields, e.target.checked)} />
                            {opt.label}
                          </label>
                        ))}
                        <div><label {...lbl}>Fußzeile (Seite)</label>
                          <input {...inp} value={gui.footerText} placeholder="z.B. Vertraulich · Seite {{page}}" onChange={e => updateGui('footerText', e.target.value)} /></div>
                      </div>
                    </div>

                    {/* Grafik-Elemente */}
                    <div><div {...sec}>Grafik-Elemente</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <ImageUpload field="headerImage" label="Header-Bild (Briefkopf-Banner)" maxH={80} hint="Empfohlen: 2480 × 300 px" />
                        <ImageUpload field="footerImage" label="Footer-Bild (Brieffuß-Banner)" maxH={60} hint="Empfohlen: 2480 × 200 px" />
                        <ImageUpload field="bgImage" label="Hintergrundbild / Briefpapier" maxH={90} hint="Empfohlen: A4 (2480 × 3508 px)" />
                        {gui.bgImageBase64 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div><label {...lbl}>Modus</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {[{ v: 'behind', l: '🖼 Briefpapier' }, { v: 'watermark', l: '💧 Wasserzeichen' }].map(opt => (
                                  <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '6px 10px', border: `1.5px solid ${gui.bgImageMode === opt.v ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 7, flex: 1, background: gui.bgImageMode === opt.v ? 'var(--color-primary-light)' : 'var(--surface-page)' }}>
                                    <input type="radio" name="bgMode" value={opt.v} checked={gui.bgImageMode === opt.v} onChange={() => updateGui('bgImageMode', opt.v)} style={{ display: 'none' }} />{opt.l}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div><label {...lbl}>Deckkraft: {Math.round(gui.bgImageOpacity * 100)}%</label>
                              <input type="range" min="1" max="60" step="1" value={Math.round(gui.bgImageOpacity * 100)} onChange={e => updateGui('bgImageOpacity', parseInt(e.target.value) / 100)} style={{ width: '100%' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Platzhalter */}
                    <div><div {...sec}>Verfügbare Platzhalter</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {[
                          ['{{praxis_name}}','Praxisname'],['{{primary_color}}','Hauptfarbe'],
                          ['{{font_family}}','Schriftart'],['{{font_size}}','Schriftgröße'],
                          ['{{report_title}}','Berichtstitel'],['{{today}}','Datum'],
                          ['{{patient_name}}','Patientenname'],['{{patient_dob}}','Geburtsdatum'],
                          ['{{therapist_name}}','Therapeut'],['{{content}}','Hauptinhalt (Pflicht!)'],
                          ['{{header_image_base64}}','Header-Bild'],['{{footer_image_base64}}','Footer-Bild'],
                          ['{{bg_image_base64}}','Hintergrundbild'],['{{footer_text}}','Fußzeile'],
                        ].map(([ph, d]) => (
                          <div key={ph} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'baseline' }}>
                            <code style={{ background: 'var(--surface-panel)', padding: '1px 5px', borderRadius: 4, color: 'var(--color-primary)', fontFamily: 'monospace', flexShrink: 0 }}>{ph}</code>
                            <span style={{ color: 'var(--text-muted)' }}>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Wichtig: Der Platzhalter <code style={{ background: 'var(--surface-panel)', padding: '1px 4px', borderRadius: 3, color: 'var(--color-primary)' }}>{'{{content}}'}</code> muss vorhanden sein.
                    </div>
                    <textarea value={htmlContent} onChange={e => { setHtmlContent(e.target.value); markDirty() }}
                      style={{ width: '100%', minHeight: 480, padding: 12, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--surface-page)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                      spellCheck={false} />
                    <button onClick={() => { setHtmlContent(defaultHtml); markDirty() }} className="btn-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      <RefreshCw style={{ width: 12, height: 12 }} /> Zurücksetzen
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Vorschau */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Vorschau (Musterdaten)</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={refreshPreview} className="btn-ghost" style={{ padding: 5 }} title="Aktualisieren">
                <RefreshCw style={{ width: 13, height: 13, opacity: previewLoading ? 0.4 : 1 }} />
              </button>
              {previewHtml && (
                <button onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(previewHtml); w.document.close() } }}
                  className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                  Drucken / PDF
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', justifyContent: 'center' }}>
            {!previewHtml && previewLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            )}
            {previewHtml && (
              <iframe ref={iframeRef} style={{ width: '210mm', minHeight: '297mm', background: 'white', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 4 }} title="Berichts-Vorschau" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
