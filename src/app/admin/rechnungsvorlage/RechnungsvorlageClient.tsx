'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Save, Star, Copy, Eye, EyeOff, Code, Sliders,
  ArrowLeft, RefreshCw, FileText, Check, AlertCircle,
} from 'lucide-react'

// ── Typen ─────────────────────────────────────────────────────────────────────

interface GuiFields {
  invoiceTitle: string
  primaryColor: string
  paymentDays: number
  iban: string
  bic: string
  bankName: string
  taxNumber: string
  vatId: string
  praxisName: string
  praxisAddress: string
  praxisPhone: string
  praxisEmail: string
  footerText: string
  showQrCode: boolean
  headerImageBase64: string
  headerImageMime: string
  footerImageBase64: string
  footerImageMime: string
  bgImageBase64: string
  bgImageMime: string
  bgImageOpacity: number
  bgImageMode: string
}

interface Template {
  id: string
  name: string
  description: string | null
  htmlContent: string
  isDefault: boolean
  invoiceTitle: string | null
  primaryColor: string | null
  paymentDays: number
  iban: string | null
  bic: string | null
  bankName: string | null
  taxNumber: string | null
  vatId: string | null
  praxisName: string | null
  praxisAddress: string | null
  praxisPhone: string | null
  praxisEmail: string | null
  footerText: string | null
  showQrCode: boolean
}

const EMPTY_GUI: GuiFields = {
  invoiceTitle: 'Honorarnote',
  primaryColor: '#4f46e5',
  paymentDays: 14,
  iban: '',
  bic: '',
  bankName: '',
  taxNumber: '',
  vatId: '',
  praxisName: '',
  praxisAddress: '',
  praxisPhone: '',
  praxisEmail: '',
  footerText: '',
  showQrCode: true,
  headerImageBase64: '',
  headerImageMime: '',
  footerImageBase64: '',
  footerImageMime: '',
  bgImageBase64: '',
  bgImageMime: '',
  bgImageOpacity: 0.08,
  bgImageMode: 'behind',
}

function templateToGui(t: Template): GuiFields {
  return {
    invoiceTitle: t.invoiceTitle ?? 'Honorarnote',
    primaryColor: t.primaryColor ?? '#4f46e5',
    paymentDays:  t.paymentDays ?? 14,
    iban:         t.iban ?? '',
    bic:          t.bic ?? '',
    bankName:     t.bankName ?? '',
    taxNumber:    t.taxNumber ?? '',
    vatId:        t.vatId ?? '',
    praxisName:   t.praxisName ?? '',
    praxisAddress:t.praxisAddress ?? '',
    praxisPhone:  t.praxisPhone ?? '',
    praxisEmail:  t.praxisEmail ?? '',
    footerText:        t.footerText        ?? '',
    showQrCode:        t.showQrCode        ?? true,
    headerImageBase64: (t as any).headerImageBase64 ?? '',
    headerImageMime:   (t as any).headerImageMime   ?? '',
    footerImageBase64: (t as any).footerImageBase64 ?? '',
    footerImageMime:   (t as any).footerImageMime   ?? '',
    bgImageBase64:     (t as any).bgImageBase64     ?? '',
    bgImageMime:       (t as any).bgImageMime       ?? '',
    bgImageOpacity:    (t as any).bgImageOpacity    ?? 0.08,
    bgImageMode:       (t as any).bgImageMode       ?? 'behind',
  }
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function RechnungsvorlageClient({
  templates: initialTemplates,
  defaultHtml,
  lastTransaction,
}: {
  templates: Template[]
  defaultHtml: string
  lastTransaction: { id: string; referenceNumber: string; payerName: string; amountGross: any } | null
}) {
  const router = useRouter()

  // Vorlagen
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [activeId, setActiveId] = useState<string | null>(initialTemplates[0]?.id ?? null)
  const active = templates.find(t => t.id === activeId) ?? null

  // Editor-Modus
  const [editorMode, setEditorMode] = useState<'gui' | 'html'>('gui')
  const [gui, setGui] = useState<GuiFields>(active ? templateToGui(active) : EMPTY_GUI)
  const [htmlContent, setHtmlContent] = useState<string>(active?.htmlContent ?? defaultHtml)
  const [templateName, setTemplateName] = useState(active?.name ?? '')
  const [templateDesc, setTemplateDesc] = useState(active?.description ?? '')

  // Vorschau
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewMode, setPreviewMode] = useState<'mock' | 'real'>('mock')
  const [previewLoading, setPreviewLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Status
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  // Aktive Vorlage wechseln
  useEffect(() => {
    if (!active) return
    setGui(templateToGui(active))
    setHtmlContent(active.htmlContent)
    setTemplateName(active.name)
    setTemplateDesc(active.description ?? '')
    setDirty(false)
  }, [activeId])

  // Live-Vorschau (debounced)
  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/invoice-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent,
          guiFields: gui,
          useReal: previewMode === 'real',
          transactionId: lastTransaction?.id,
        }),
      })
      const data = await res.json()
      setPreviewHtml(data.html ?? '')
    } catch { /* ignore */ }
    setPreviewLoading(false)
  }, [htmlContent, gui, previewMode, lastTransaction])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(refreshPreview, 600)
    return () => clearTimeout(debounceRef.current)
  }, [refreshPreview])

  // Iframe updaten wenn previewHtml sich ändert
  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open()
    doc.write(previewHtml)
    doc.close()
  }, [previewHtml])

  function markDirty() { setDirty(true); setSaved(false) }

  function updateGui(field: keyof GuiFields, value: any) {
    setGui(g => ({ ...g, [field]: value }))
    markDirty()
  }

  // ── Speichern ───────────────────────────────────────────────────────────────

  async function save() {
    if (!activeId) return
    setSaving(true); setError('')
    try {
      // GUI-Felder und Name immer speichern
      // htmlContent nur wenn im HTML-Editor (vermeidet großen Request)
      const saveBody: any = {
        name: templateName,
        description: templateDesc,
        ...gui,
      }
      if (editorMode === 'html') {
        saveBody.htmlContent = htmlContent
      }
      const res = await fetch(`/api/invoice-templates/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveBody),
      })
      let updated: any
      try { updated = await res.json() } catch {
        throw new Error(`Server-Fehler (${res.status})`)
      }
      if (!res.ok) throw new Error(updated?.error ?? `Fehler ${res.status}`)
      setTemplates(ts => ts.map(t => t.id === activeId ? { ...t, ...updated } : t))
      setSaved(true); setDirty(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  // ── Neue Vorlage ─────────────────────────────────────────────────────────────

  async function createNew() {
    setSaving(true)
    try {
      const res = await fetch('/api/invoice-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neue Vorlage',
          isDefault: templates.length === 0,
          ...EMPTY_GUI,
        }),
      })
      const t = await res.json()
      setTemplates(ts => [t, ...ts])
      setActiveId(t.id)
    } catch { /* ignore */ }
    setSaving(false)
  }

  // ── Duplizieren ──────────────────────────────────────────────────────────────

  async function duplicate() {
    if (!active) return
    setSaving(true)
    try {
      const res = await fetch('/api/invoice-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${active.name} (Kopie)`,
          description: active.description,
          isDefault: false,
          duplicateFrom: active.id,
        }),
      })
      const t = await res.json()
      setTemplates(ts => [t, ...ts])
      setActiveId(t.id)
    } catch { /* ignore */ }
    setSaving(false)
  }

  // ── Als Standard setzen ───────────────────────────────────────────────────────

  async function setDefault() {
    if (!activeId) return
    try {
      await fetch(`/api/invoice-templates/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      setTemplates(ts => ts.map(t => ({ ...t, isDefault: t.id === activeId })))
    } catch { /* ignore */ }
  }

  // ── Löschen ───────────────────────────────────────────────────────────────────

  async function deleteTemplate() {
    if (!activeId || !confirm('Vorlage wirklich löschen?')) return
    await fetch(`/api/invoice-templates/${activeId}`, { method: 'DELETE' })
    const remaining = templates.filter(t => t.id !== activeId)
    setTemplates(remaining)
    setActiveId(remaining[0]?.id ?? null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const inputStyle = {
    width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7,
    border: '0.5px solid var(--border)', background: 'var(--surface-page)',
    color: 'var(--text-primary)', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4,
  }
  const sectionHeadStyle = {
    fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)',
    marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)',
  }

  // ── Bild-Upload Helfer ────────────────────────────────────────────────────────

  // Maximale Dimensionen je nach Bildtyp
  const MAX_DIMS: Record<string, { w: number; h: number }> = {
    headerImage: { w: 2480, h: 400 },
    footerImage:  { w: 2480, h: 300 },
    bgImage:      { w: 1240, h: 1754 }, // A4 halbe Auflösung
  }
  const JPEG_QUALITY = 0.82

  function compressAndStore(
    field: 'headerImage' | 'footerImage' | 'bgImage',
    file: File,
  ) {
    const isSvg = file.type === 'image/svg+xml'
    const isPdf = file.type === 'application/pdf'

    // SVG und PDF: direkt als Base64 ohne Komprimierung (sind meist klein)
    if (isSvg || isPdf) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        updateGui(`${field}Base64` as keyof GuiFields, base64)
        updateGui(`${field}Mime` as keyof GuiFields, file.type)
      }
      reader.readAsDataURL(file)
      return
    }

    // PNG/JPG: über Canvas skalieren + als JPEG komprimieren
    const { w: maxW, h: maxH } = MAX_DIMS[field]
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      // Skalieren falls zu groß
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      const base64  = dataUrl.split(',')[1]
      const kbBefore = Math.round(file.size / 1024)
      const kbAfter  = Math.round(base64.length * 0.75 / 1024)
      console.log(`${field}: ${kbBefore} KB → ${kbAfter} KB (${width}×${height}px)`)
      updateGui(`${field}Base64` as keyof GuiFields, base64)
      updateGui(`${field}Mime` as keyof GuiFields, 'image/jpeg')
    }
    img.onerror = () => {
      // Fallback: direkt speichern
      URL.revokeObjectURL(url)
      const reader = new FileReader()
      reader.onload = () => {
        updateGui(`${field}Base64` as keyof GuiFields, (reader.result as string).split(',')[1])
        updateGui(`${field}Mime` as keyof GuiFields, file.type)
      }
      reader.readAsDataURL(file)
    }
    img.src = url
  }

  function handleImageUpload(
    field: 'headerImage' | 'footerImage' | 'bgImage',
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png','image/jpeg','image/svg+xml','application/pdf']
    if (!allowed.includes(file.type)) {
      alert('Nur PNG, JPG, SVG und PDF sind erlaubt.')
      return
    }
    compressAndStore(field, file)
  }

  function clearImage(field: 'headerImage' | 'footerImage' | 'bgImage') {
    updateGui(`${field}Base64` as keyof GuiFields, '')
    updateGui(`${field}Mime` as keyof GuiFields, '')
  }

    return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={() => router.push('/admin/settings')} className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Administration
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Rechnungsvorlage</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && (
            <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle style={{ width: 13, height: 13 }} />{error}
            </span>
          )}
          {dirty && !saved && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ungespeicherte Änderungen</span>
          )}
          {saved && (
            <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check style={{ width: 13, height: 13 }} /> Gespeichert
            </span>
          )}
          <button onClick={save} disabled={saving || !activeId} className="btn-primary" style={{ fontSize: 13 }}>
            <Save style={{ width: 13, height: 13 }} />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* ── Dreispalten-Layout ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Spalte 1: Vorlagen-Liste ── */}
        <div style={{
          width: 220, flexShrink: 0, background: 'var(--surface-card)',
          borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Vorlagen</span>
            <button onClick={createNew} className="btn-ghost" style={{ padding: 4 }} title="Neue Vorlage">
              <Plus style={{ width: 15, height: 15 }} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {templates.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Noch keine Vorlagen.<br />
                <button onClick={createNew} className="btn-secondary" style={{ fontSize: 12, marginTop: 10 }}>
                  <Plus style={{ width: 13, height: 13 }} /> Erste erstellen
                </button>
              </div>
            )}
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: t.id === activeId ? 'var(--color-primary-light)' : 'none',
                  border: 'none', borderLeft: t.id === activeId ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.id === activeId ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                    {t.name}
                  </span>
                  {t.isDefault && (
                    <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                      Standard
                    </span>
                  )}
                </div>
                {t.description && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Spalte 2: Editor ── */}
        <div style={{
          width: 380, flexShrink: 0, background: 'var(--surface-page)',
          borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {!active ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <FileText style={{ width: 40, height: 40, color: 'var(--text-muted)', opacity: 0.3 }} />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Keine Vorlage ausgewählt</span>
              <button onClick={createNew} className="btn-primary" style={{ fontSize: 13 }}>
                <Plus style={{ width: 14, height: 14 }} /> Erste Vorlage erstellen
              </button>
            </div>
          ) : (
            <>
              {/* Editor-Header */}
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setEditorMode('gui')}
                  className={editorMode === 'gui' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                >
                  <Sliders style={{ width: 13, height: 13 }} /> Einfach
                </button>
                <button
                  onClick={() => setEditorMode('html')}
                  className={editorMode === 'html' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                >
                  <Code style={{ width: 13, height: 13 }} /> HTML
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {!active.isDefault && (
                    <button onClick={setDefault} className="btn-ghost" style={{ padding: 5, fontSize: 11 }} title="Als Standard setzen">
                      <Star style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                  <button onClick={duplicate} className="btn-ghost" style={{ padding: 5 }} title="Duplizieren">
                    <Copy style={{ width: 13, height: 13 }} />
                  </button>
                  {!active.isDefault && (
                    <button onClick={deleteTemplate} className="btn-ghost" style={{ padding: 5, color: 'var(--red)' }} title="Löschen">
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Editor-Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

                {/* Vorlagen-Name & Beschreibung */}
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>Vorlagenname</label>
                    <input style={inputStyle} value={templateName}
                      onChange={e => { setTemplateName(e.target.value); markDirty() }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Beschreibung (optional)</label>
                    <input style={inputStyle} value={templateDesc}
                      placeholder="z.B. Für Privatpatienten"
                      onChange={e => { setTemplateDesc(e.target.value); markDirty() }} />
                  </div>
                </div>

                {editorMode === 'gui' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Allgemein */}
                    <div>
                      <div style={sectionHeadStyle}>Allgemein</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={labelStyle}>Rechnungstitel</label>
                          <input style={inputStyle} value={gui.invoiceTitle}
                            placeholder="z.B. Honorarnote, Rechnung, Therapierechnung"
                            onChange={e => updateGui('invoiceTitle', e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={labelStyle}>Hauptfarbe</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input type="color" value={gui.primaryColor}
                                onChange={e => updateGui('primaryColor', e.target.value)}
                                style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                              <input style={{ ...inputStyle, flex: 1 }} value={gui.primaryColor}
                                onChange={e => updateGui('primaryColor', e.target.value)} />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Zahlungsziel (Tage)</label>
                            <input type="number" style={inputStyle} value={gui.paymentDays} min={1} max={90}
                              onChange={e => updateGui('paymentDays', parseInt(e.target.value) || 14)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Praxisdaten */}
                    <div>
                      <div style={sectionHeadStyle}>Praxisdaten auf Rechnung</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Praxisname (leer = aus Branding)</label>
                          <input style={inputStyle} value={gui.praxisName} placeholder="Automatisch aus Branding"
                            onChange={e => updateGui('praxisName', e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Adresse</label>
                          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={gui.praxisAddress}
                            placeholder="Musterstraße 1&#10;1010 Wien"
                            onChange={e => updateGui('praxisAddress', e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={labelStyle}>Telefon</label>
                            <input style={inputStyle} value={gui.praxisPhone}
                              onChange={e => updateGui('praxisPhone', e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>E-Mail</label>
                            <input style={inputStyle} value={gui.praxisEmail}
                              onChange={e => updateGui('praxisEmail', e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={labelStyle}>Steuernummer</label>
                            <input style={inputStyle} value={gui.taxNumber} placeholder="123/4567"
                              onChange={e => updateGui('taxNumber', e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>UID-Nummer</label>
                            <input style={inputStyle} value={gui.vatId} placeholder="ATU12345678"
                              onChange={e => updateGui('vatId', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bankverbindung */}
                    <div>
                      <div style={sectionHeadStyle}>Bankverbindung</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label style={labelStyle}>IBAN</label>
                          <input style={inputStyle} value={gui.iban} placeholder="AT12 3456 7890 1234 5678"
                            onChange={e => updateGui('iban', e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={labelStyle}>BIC</label>
                            <input style={inputStyle} value={gui.bic} placeholder="MUSTBICXX"
                              onChange={e => updateGui('bic', e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Bank</label>
                            <input style={inputStyle} value={gui.bankName} placeholder="Musterbank AG"
                              onChange={e => updateGui('bankName', e.target.value)} />
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <input type="checkbox" checked={gui.showQrCode}
                            onChange={e => updateGui('showQrCode', e.target.checked)} />
                          SEPA QR-Code auf Rechnung anzeigen
                        </label>
                      </div>
                    </div>

                    {/* Fußzeile */}
                    <div>
                      <div style={sectionHeadStyle}>Fußzeile</div>
                      <div>
                        <label style={labelStyle}>Fußtext (erscheint unten auf der Rechnung)</label>
                        <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                          value={gui.footerText}
                          placeholder="z.B. Vielen Dank für Ihr Vertrauen. Alle Angaben ohne Gewähr."
                          onChange={e => updateGui('footerText', e.target.value)} />
                      </div>
                    </div>

                    {/* Design-Elemente */}
                    <div>
                      <div style={sectionHeadStyle}>Design-Elemente</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Header-Bild */}
                        <div>
                          <label style={labelStyle}>Header-Bild (Briefkopf-Banner)</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {gui.headerImageBase64 ? (
                              <div style={{ position: 'relative', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                <img
                                  src={`data:${gui.headerImageMime};base64,${gui.headerImageBase64}`}
                                  style={{ width: '100%', maxHeight: 80, objectFit: 'cover', display: 'block' }}
                                  alt="Header"
                                />
                                <button onClick={() => clearImage('headerImage')}
                                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>
                                  ✕ Entfernen
                                </button>
                              </div>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                                <input type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" style={{ display: 'none' }}
                                  onChange={e => handleImageUpload('headerImage', e)} />
                                📁 PNG, JPG, SVG oder PDF hochladen
                              </label>
                            )}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empfohlen: 2480 × 300 px, volle Breite</div>
                          </div>
                        </div>

                        {/* Footer-Bild */}
                        <div>
                          <label style={labelStyle}>Footer-Bild (Brieffuß-Banner)</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {gui.footerImageBase64 ? (
                              <div style={{ position: 'relative', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                <img
                                  src={`data:${gui.footerImageMime};base64,${gui.footerImageBase64}`}
                                  style={{ width: '100%', maxHeight: 60, objectFit: 'cover', display: 'block' }}
                                  alt="Footer"
                                />
                                <button onClick={() => clearImage('footerImage')}
                                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>
                                  ✕ Entfernen
                                </button>
                              </div>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                                <input type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" style={{ display: 'none' }}
                                  onChange={e => handleImageUpload('footerImage', e)} />
                                📁 PNG, JPG, SVG oder PDF hochladen
                              </label>
                            )}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empfohlen: 2480 × 200 px, volle Breite</div>
                          </div>
                        </div>

                        {/* Hintergrundbild */}
                        <div>
                          <label style={labelStyle}>Hintergrundbild / Briefpapier</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {gui.bgImageBase64 ? (
                              <div style={{ position: 'relative', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                <img
                                  src={`data:${gui.bgImageMime};base64,${gui.bgImageBase64}`}
                                  style={{ width: '100%', maxHeight: 100, objectFit: 'cover', display: 'block', opacity: gui.bgImageOpacity }}
                                  alt="Hintergrund"
                                />
                                <button onClick={() => clearImage('bgImage')}
                                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>
                                  ✕ Entfernen
                                </button>
                              </div>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                                <input type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" style={{ display: 'none' }}
                                  onChange={e => handleImageUpload('bgImage', e)} />
                                📁 PNG, JPG, SVG oder PDF hochladen
                              </label>
                            )}

                            {gui.bgImageBase64 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div>
                                  <label style={labelStyle}>Modus</label>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {[
                                      { value: 'behind', label: '🖼 Briefpapier (hinter Text)' },
                                      { value: 'watermark', label: '💧 Wasserzeichen (über Text)' },
                                    ].map(opt => (
                                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '6px 10px', border: `1.5px solid ${gui.bgImageMode === opt.value ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 7, flex: 1, background: gui.bgImageMode === opt.value ? 'var(--color-primary-light)' : 'var(--surface-page)' }}>
                                        <input type="radio" name="bgMode" value={opt.value} checked={gui.bgImageMode === opt.value}
                                          onChange={() => updateGui('bgImageMode', opt.value)} style={{ display: 'none' }} />
                                        {opt.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label style={labelStyle}>Deckkraft: {Math.round(gui.bgImageOpacity * 100)}%</label>
                                  <input type="range" min="1" max="100" step="1"
                                    value={Math.round(gui.bgImageOpacity * 100)}
                                    onChange={e => updateGui('bgImageOpacity', parseInt(e.target.value) / 100)}
                                    style={{ width: '100%' }} />
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                                    <span>1% (kaum sichtbar)</span><span>100% (vollständig)</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empfohlen: A4 (2480 × 3508 px) für Briefpapier</div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Platzhalter-Referenz */}
                    <div>
                      <div style={sectionHeadStyle}>Verfügbare Platzhalter (für HTML-Editor)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {[
                          ['{{praxis_name}}', 'Praxisname'],
                          ['{{praxis_address}}', 'Adresse'],
                          ['{{primary_color}}', 'Hauptfarbe (Hex)'],
                          ['{{invoice_title}}', 'Rechnungstitel'],
                          ['{{reference_number}}', 'Rechnungsnummer'],
                          ['{{transaction_date}}', 'Rechnungsdatum'],
                          ['{{due_date}}', 'Fälligkeitsdatum'],
                          ['{{payer_name}}', 'Rechnungsempfänger'],
                          ['{{amount_gross}}', 'Bruttobetrag'],
                          ['{{payment_info}}', 'Bankverbindung (Text)'],
                          ['{{qr_code}}', 'SEPA QR-Code (HTML)'],
                          ['{{tax_number}}', 'Steuernummer'],
                          ['{{vat_id}}', 'UID-Nummer'],
                          ['{{footer_text}}', 'Fußzeile'],
                          ['{{header_image_base64}}', 'Header-Bild (Base64)'],
                          ['{{header_image_mime}}', 'Header-Bild MIME-Typ'],
                          ['{{footer_image_base64}}', 'Footer-Bild (Base64)'],
                          ['{{bg_image_base64}}', 'Hintergrundbild (Base64)'],
                          ['{{bg_image_opacity}}', 'Hintergrund-Deckkraft (0.0–1.0)'],
                          ['{{#if header_image_base64}}...{{/if}}', 'Nur wenn Header-Bild vorhanden'],
                          ['{{#if footer_image_base64}}...{{/if}}', 'Nur wenn Footer-Bild vorhanden'],
                          ['{{#if bg_image_base64}}...{{/if}}', 'Nur wenn Hintergrund vorhanden'],
                        ].map(([ph, desc]) => (
                          <div key={ph} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'baseline' }}>
                            <code style={{ background: 'var(--surface-panel)', padding: '1px 5px', borderRadius: 4, color: 'var(--color-primary)', fontFamily: 'monospace', flexShrink: 0 }}>{ph}</code>
                            <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : (
                  /* HTML-Editor */
                  <div>
                    <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      Vollständiger HTML/CSS-Editor. Platzhalter werden beim Drucken ersetzt.
                    </div>
                    <textarea
                      value={htmlContent}
                      onChange={e => { setHtmlContent(e.target.value); markDirty() }}
                      style={{
                        width: '100%', minHeight: 500, padding: 12,
                        fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
                        border: '0.5px solid var(--border)', borderRadius: 8,
                        background: 'var(--surface-page)', color: 'var(--text-primary)',
                        resize: 'vertical', boxSizing: 'border-box',
                      }}
                      spellCheck={false}
                    />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { setHtmlContent(active.htmlContent); markDirty() }}
                        className="btn-secondary"
                        style={{ fontSize: 12 }}
                      >
                        <RefreshCw style={{ width: 12, height: 12 }} /> Zurücksetzen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Spalte 3: Vorschau ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#e5e7eb' }}>

          {/* Vorschau-Header */}
          <div style={{
            padding: '10px 16px', background: 'var(--surface-card)',
            borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Eye style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Vorschau</span>

            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button
                onClick={() => setPreviewMode('mock')}
                className={previewMode === 'mock' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                Musterdaten
              </button>
              {lastTransaction && (
                <button
                  onClick={() => setPreviewMode('real')}
                  className={previewMode === 'real' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  title={`Letzte Transaktion: ${lastTransaction.referenceNumber} – ${lastTransaction.payerName}`}
                >
                  Echte Daten
                </button>
              )}
              <button onClick={refreshPreview} className="btn-ghost" style={{ padding: 5 }} title="Vorschau aktualisieren">
                <RefreshCw style={{ width: 13, height: 13, opacity: previewLoading ? 0.4 : 1 }} />
              </button>
              {previewHtml && (
                <button
                  onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(previewHtml); w.document.close() }
                  }}
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  Drucken / PDF
                </button>
              )}
            </div>
          </div>

          {/* iFrame-Vorschau */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
            {previewLoading && !previewHtml && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <div className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            )}
            {previewHtml && (
              <iframe
                ref={iframeRef}
                style={{
                  width: '210mm', minHeight: '297mm',
                  background: 'white',
                  border: 'none',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                  borderRadius: 4,
                }}
                title="Rechnungsvorschau"
              />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
