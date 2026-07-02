'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Upload, X, Palette, Building2, FileText, Eye, Monitor, Type } from 'lucide-react'
import type { BrandingConfig } from '@/lib/branding'

const PRESET_COLORS = [
  { name: 'KDS Standard',       primary: '#4f46e5', light: '#eef2ff', accent: '#4338ca', sidebarText: '#475569' },
  { name: 'Therapeutisch Grün', primary: '#166534', light: '#dcfce7', accent: '#14532d', sidebarText: '#475569' },
  { name: 'Vertrauens Blau',    primary: '#1e40af', light: '#dbeafe', accent: '#1e3a8a', sidebarText: '#475569' },
  { name: 'Ruhiges Grau',       primary: '#374151', light: '#f3f4f6', accent: '#1f2937', sidebarText: '#475569' },
  { name: 'Warmes Violett',     primary: '#7c3aed', light: '#ede9fe', accent: '#5b21b6', sidebarText: '#475569' },
  { name: 'Ozean Teal',         primary: '#0f766e', light: '#ccfbf1', accent: '#0d5f58', sidebarText: '#475569' },
]

const DEFAULT_VALUES = {
  colorPrimary: '#4f46e5',
  colorPrimaryLight: '#eef2ff',
  colorAccent: '#4338ca',
  colorSidebarText: '#475569',
  iban: '',
  bic: '',
  bankName: '',
  taxNumber: '',
  vatId: '',
}

export function BrandingClient({ initial }: { initial: BrandingConfig }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const loginBgRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    ...initial,
    bundesland: initial.bundesland ?? 'Kärnten',
    loginBgImageBase64: (initial as any).loginBgImageBase64 ?? null,
    loginBgImageMime:   (initial as any).loginBgImageMime   ?? null,
    loginBgColor:       (initial as any).loginBgColor       ?? null,
    loginBoxPosition:   (initial as any).loginBoxPosition   ?? 'center',
    loginBgOverlay:     (initial as any).loginBgOverlay     ?? 0,
    loginLogoSize:      (initial as any).loginLogoSize      ?? 64,
    loginBoxOffsetX:    (initial as any).loginBoxOffsetX    ?? 0,
    loginBoxOffsetY:    (initial as any).loginBoxOffsetY    ?? 0,
    loginCardBg:        (initial as any).loginCardBg        ?? 'rgba(255,255,255,0.92)',
    loginCardBlur:      (initial as any).loginCardBlur      ?? 12,
    loginCardRadius:    (initial as any).loginCardRadius    ?? 20,
    loginCardShadow:    (initial as any).loginCardShadow    ?? true,
    appFontFamily:      (initial as any).appFontFamily      ?? 'system',
    appFontSize:        (initial as any).appFontSize        ?? 14,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [preview, setPreview] = useState(false)

  function set(k: string, v: any) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'colorPrimary')      document.documentElement.style.setProperty('--color-primary', v)
    if (k === 'colorPrimaryLight') document.documentElement.style.setProperty('--color-primary-light', v)
    if (k === 'colorAccent')       document.documentElement.style.setProperty('--color-accent', v)
    if (k === 'colorSidebarText')  document.documentElement.style.setProperty('--sb-text', v)
  }

  function applyPreset(p: typeof PRESET_COLORS[0]) {
    set('colorPrimary', p.primary)
    set('colorPrimaryLight', p.light)
    set('colorAccent', p.accent)
    set('colorSidebarText', p.sidebarText)
    setForm(f => ({ ...f, colorPrimary: p.primary, colorPrimaryLight: p.light, colorAccent: p.accent, colorSidebarText: p.sidebarText }))
  }

  function resetToDefault() {
    Object.entries(DEFAULT_VALUES).forEach(([k, v]) => set(k, v))
    setForm(f => ({ ...f, ...DEFAULT_VALUES }))
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Datei zu groß. Bitte max. 5 MB.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const [header, base64] = result.split(',')
      const mimeType = header.match(/data:(.+);/)?.[1] ?? 'image/png'
      setForm(f => ({ ...f, logoBase64: base64, logoMimeType: mimeType }))
    }
    reader.readAsDataURL(file)
  }

  function handleLoginBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { alert('Datei zu groß. Bitte max. 8 MB.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const [header, base64] = result.split(',')
      const mimeType = header.match(/data:(.+);/)?.[1] ?? 'image/jpeg'
      setForm(f => ({ ...f, loginBgImageBase64: base64, loginBgImageMime: mimeType } as any))
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (e) {
      alert('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    } finally {
      setSaving(false)
    }
  }

  const logoSrc = form.logoBase64
    ? `data:${form.logoMimeType};base64,${form.logoBase64}`
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Branding & Praxis</h1>
          <p className="text-slate-400 text-sm mt-0.5">Personalisieren Sie die App für Ihre Praxis</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)} className="btn-secondary">
            <Eye className="w-4 h-4" /> {preview ? 'Vorschau aus' : 'Live-Vorschau'}
          </button>
          <button onClick={resetToDefault} className="btn-secondary" title="Auf KDS-Standard zurücksetzen">
            Auf Standard zurücksetzen
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" />
            {saving ? 'Speichern…' : saved ? '✓ Gespeichert' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte: Einstellungen */}
        <div className="lg:col-span-2 space-y-4">

          {/* Praxis-Info */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Praxis-Informationen</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Praxisname</label>
                <input className="input" value={form.praxisName}
                  onChange={e => set('praxisName', e.target.value)}
                  placeholder="Dr. Max Mustermann – Psychotherapeutische Praxis" />
              </div>
              <div>
                <label className="label">Slogan / Untertitel</label>
                <input className="input" value={form.slogan ?? ''}
                  onChange={e => set('slogan', e.target.value)}
                  placeholder="Klinische Diagnostik & Dokumentation" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kontakt E-Mail</label>
                  <input type="email" className="input" value={form.contactEmail ?? ''}
                    onChange={e => set('contactEmail', e.target.value)}
                    placeholder="praxis@beispiel.at" />
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input className="input" value={form.contactPhone ?? ''}
                    onChange={e => set('contactPhone', e.target.value)}
                    placeholder="+43 1 234 567 890" />
                </div>
              </div>
              <div>
                <label className="label">Bundesland (für Schulferien im Kalender)</label>
                <select className="input" value={form.bundesland ?? 'Kärnten'}
                  onChange={e => set('bundesland', e.target.value)}>
                  {['Burgenland','Kärnten','Niederösterreich','Oberösterreich','Salzburg','Steiermark','Tirol','Vorarlberg','Wien'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Adresse</label>
                <input className="input" value={form.address ?? ''}
                  onChange={e => set('address', e.target.value)}
                  placeholder="Musterstraße 1, 1010 Wien" />
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Logo</h2>
            </div>
            <div className="flex items-center gap-4">
              {logoSrc ? (
                <div className="relative">
                  <img src={logoSrc} alt="Logo" style={{ width: 80, height: 80, borderRadius: 16, objectFit: "contain", border: "0.5px solid var(--border)", padding: 8 }} />
                  <button
                    onClick={() => setForm(f => ({ ...f, logoBase64: null, logoMimeType: null }))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 16, border: "2px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Upload className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden" onChange={handleLogoUpload} />
                <button onClick={() => fileRef.current?.click()} className="btn-secondary">
                  <Upload className="w-4 h-4" /> Logo hochladen
                </button>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>PNG, SVG, JPG · max. 500 KB empfohlen</p>
              </div>
            </div>
          </div>

          {/* Farben */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Farben</h2>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Farbpaletten</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="btn-secondary" style={{ fontSize: 12 }}
                    title={p.name}
                  >
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: p.primary }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'colorPrimary',      label: 'Primärfarbe',       desc: 'Buttons, aktive Links' },
                { key: 'colorPrimaryLight', label: 'Hintergrundton',    desc: 'Aktiver Menüpunkt' },
                { key: 'colorAccent',       label: 'Akzentfarbe',       desc: 'Hover-Zustände' },
                { key: 'colorSidebarText',  label: 'Sidebar Schrift',   desc: 'Menü-Textfarbe' },
              ].map(({ key, label, desc }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(form as any)[key]}
                      onChange={e => set(key, e.target.value)}
                      style={{ width: 40, height: 40, borderRadius: 8, border: "0.5px solid var(--border-strong)", cursor: "pointer", padding: 2 }}
                    />
                    <input
                      className="input font-mono text-xs"
                      value={(form as any)[key]}
                      onChange={e => set(key, e.target.value)}
                      maxLength={7}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bankverbindung */}
          <div className="card p-6">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏦 Bankverbindung &amp; Steuerdaten
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Wird automatisch in Honorarnoten, Berichten und E-Mails verwendet.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">IBAN</label>
                <input className="input" value={form.iban ?? ''}
                  onChange={e => set('iban', e.target.value)}
                  placeholder="AT12 3456 7890 1234 5678" />
              </div>
              <div>
                <label className="label">BIC</label>
                <input className="input" value={form.bic ?? ''}
                  onChange={e => set('bic', e.target.value)}
                  placeholder="MUSTBICXX" />
              </div>
              <div>
                <label className="label">Bank</label>
                <input className="input" value={form.bankName ?? ''}
                  onChange={e => set('bankName', e.target.value)}
                  placeholder="Musterbank AG" />
              </div>
              <div>
                <label className="label">Steuernummer</label>
                <input className="input" value={form.taxNumber ?? ''}
                  onChange={e => set('taxNumber', e.target.value)}
                  placeholder="123/4567" />
              </div>
              <div>
                <label className="label">UID-Nummer</label>
                <input className="input" value={form.vatId ?? ''}
                  onChange={e => set('vatId', e.target.value)}
                  placeholder="ATU12345678" />
              </div>
            </div>
          </div>

          {/* Impressum */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Impressum / Über diese App</h2>
            </div>
            <label className="label">Inhalt (HTML erlaubt)</label>
            <textarea
              className="input font-mono text-xs"
              rows={6}
              value={form.imprintHtml ?? ''}
              onChange={e => set('imprintHtml', e.target.value)}
              placeholder="<p>Betreiber: Dr. Max Mustermann ...</p>"
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Wird auf der Seite /impressum angezeigt</p>
          </div>

          {/* Login-Seite Design */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Login-Seite Design</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24, alignItems: 'start' }}>
              {/* Linke Spalte: Controls */}
              <div className="space-y-4">

                {/* Hintergrundbild */}
                <div>
                  <label className="label">Hintergrundbild</label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 100, height: 60, borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden', background: (form as any).loginBgColor ?? '#f0f2f7', flexShrink: 0 }}>
                      {(form as any).loginBgImageBase64 && (
                        <img src={`data:${(form as any).loginBgImageMime};base64,${(form as any).loginBgImageBase64}`}
                          alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {!(form as any).loginBgImageBase64 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: 'var(--text-muted)' }}>Kein Bild</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                      <input ref={loginBgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLoginBgUpload} />
                      <button onClick={() => loginBgRef.current?.click()} className="btn-secondary" style={{ fontSize: 12 }}>
                        <Upload className="w-3 h-3" /> Bild hochladen
                      </button>
                      {(form as any).loginBgImageBase64 && (
                        <button onClick={() => setForm(f => ({ ...f, loginBgImageBase64: null, loginBgImageMime: null } as any))} className="btn-ghost" style={{ fontSize: 12 }}>
                          <X className="w-3 h-3" /> Entfernen
                        </button>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Fallback-Farbe</label>
                        <input type="color" value={(form as any).loginBgColor ?? '#f0f2f7'}
                          onChange={e => setForm(f => ({ ...f, loginBgColor: e.target.value } as any))}
                          style={{ width: 32, height: 24, border: 'none', padding: 2, cursor: 'pointer', borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overlay */}
                {(form as any).loginBgImageBase64 && (
                  <div>
                    <label className="label">Bild abdunkeln — {Math.round(((form as any).loginBgOverlay ?? 0) * 100)}%</label>
                    <input type="range" min={0} max={0.7} step={0.05}
                      value={(form as any).loginBgOverlay ?? 0}
                      onChange={e => setForm(f => ({ ...f, loginBgOverlay: parseFloat(e.target.value) } as any))}
                      style={{ width: '100%', accentColor: form.colorPrimary }} />
                  </div>
                )}

                {/* Position 3x3 */}
                <div>
                  <label className="label">Position des Login-Felds</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, maxWidth: 160 }}>
                    {([
                      ['top-left','↖'],['top-center','↑'],['top-right','↗'],
                      ['middle-left','←'],['center','·'],['middle-right','→'],
                      ['bottom-left','↙'],['bottom-center','↓'],['bottom-right','↘'],
                    ] as [string,string][]).map(([pos, icon]) => (
                      <button key={pos} onClick={() => setForm(f => ({ ...f, loginBoxPosition: pos } as any))}
                        style={{
                          padding: '8px 0', borderRadius: 8, fontSize: 16, cursor: 'pointer',
                          border: '1.5px solid',
                          borderColor: (form as any).loginBoxPosition === pos ? form.colorPrimary : 'var(--border)',
                          background: (form as any).loginBoxPosition === pos ? form.colorPrimaryLight : 'var(--surface-page)',
                          color: (form as any).loginBoxPosition === pos ? form.colorPrimary : 'var(--text-muted)',
                        }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feinpositionierung X/Y */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Offset X — {(form as any).loginBoxOffsetX ?? 0}%</label>
                    <input type="range" min={-40} max={40} step={2}
                      value={(form as any).loginBoxOffsetX ?? 0}
                      onChange={e => setForm(f => ({ ...f, loginBoxOffsetX: parseInt(e.target.value) } as any))}
                      style={{ width: '100%', accentColor: form.colorPrimary }} />
                  </div>
                  <div>
                    <label className="label">Offset Y — {(form as any).loginBoxOffsetY ?? 0}%</label>
                    <input type="range" min={-40} max={40} step={2}
                      value={(form as any).loginBoxOffsetY ?? 0}
                      onChange={e => setForm(f => ({ ...f, loginBoxOffsetY: parseInt(e.target.value) } as any))}
                      style={{ width: '100%', accentColor: form.colorPrimary }} />
                  </div>
                </div>

                {/* Logo-Größe */}
                <div>
                  <label className="label">Logo-Größe — {(form as any).loginLogoSize ?? 64}px</label>
                  <input type="range" min={32} max={120} step={4}
                    value={(form as any).loginLogoSize ?? 64}
                    onChange={e => setForm(f => ({ ...f, loginLogoSize: parseInt(e.target.value) } as any))}
                    style={{ width: '100%', accentColor: form.colorPrimary }} />
                </div>

                {/* Card-Design */}
                <div style={{ paddingTop: 6, borderTop: '0.5px solid var(--border)' }}>
                  <label className="label" style={{ marginBottom: 10 }}>Login-Box Design</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label className="label">Box-Hintergrundfarbe & Transparenz</label>
                      {(() => {
                        // rgba(R,G,B,A) parsen für getrennte Farb- und Alpha-Steuerung
                        const raw = (form as any).loginCardBg ?? 'rgba(255,255,255,0.92)'
                        const m = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
                        const r = m ? parseInt(m[1]) : 255
                        const g = m ? parseInt(m[2]) : 255
                        const b = m ? parseInt(m[3]) : 255
                        const a = m ? parseFloat(m[4] ?? '1') : 0.92
                        const hex = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')
                        const updateCardBg = (newHex: string, newA: number) => {
                          const rr = parseInt(newHex.slice(1,3),16)
                          const gg = parseInt(newHex.slice(3,5),16)
                          const bb = parseInt(newHex.slice(5,7),16)
                          setForm(f => ({ ...f, loginCardBg: `rgba(${rr},${gg},${bb},${newA.toFixed(2)})` } as any))
                        }
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Farbe</label>
                              <input type="color" value={hex}
                                onChange={e => updateCardBg(e.target.value, a)}
                                style={{ width: 48, height: 36, border: '0.5px solid var(--border)', padding: 2, cursor: 'pointer', borderRadius: 8 }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                Transparenz — {Math.round((1 - a) * 100)}% durchsichtig
                              </label>
                              <input type="range" min={0} max={1} step={0.04}
                                value={a}
                                onChange={e => updateCardBg(hex, parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: form.colorPrimary }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
                                <span>Voll transparent</span><span>Undurchsichtig</span>
                              </div>
                            </div>
                            <div style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid var(--border)', background: raw, flexShrink: 0 }} title="Vorschau" />
                          </div>
                        )
                      })()}
                    </div>
                    <div>
                      <label className="label">Glasmorphism Blur — {(form as any).loginCardBlur ?? 12}px</label>
                      <input type="range" min={0} max={24} step={2}
                        value={(form as any).loginCardBlur ?? 12}
                        onChange={e => setForm(f => ({ ...f, loginCardBlur: parseInt(e.target.value) } as any))}
                        style={{ width: '100%', accentColor: form.colorPrimary }} />
                    </div>
                    <div>
                      <label className="label">Eck-Radius — {(form as any).loginCardRadius ?? 20}px</label>
                      <input type="range" min={0} max={32} step={2}
                        value={(form as any).loginCardRadius ?? 20}
                        onChange={e => setForm(f => ({ ...f, loginCardRadius: parseInt(e.target.value) } as any))}
                        style={{ width: '100%', accentColor: form.colorPrimary }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={(form as any).loginCardShadow ?? true}
                        onChange={e => setForm(f => ({ ...f, loginCardShadow: e.target.checked } as any))} />
                      Schatten anzeigen
                    </label>
                  </div>
                </div>
              </div>

              {/* Rechte Spalte: Live-Vorschau */}
              <div style={{ position: 'sticky', top: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Live-Vorschau</p>
                <div style={{ width: 260, height: 380, borderRadius: 12, overflow: 'hidden', border: '0.5px solid var(--border)', position: 'relative', background: (form as any).loginBgColor ?? '#f0f2f7' }}>
                  {/* BG */}
                  {(form as any).loginBgImageBase64 && (
                    <>
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(data:${(form as any).loginBgImageMime};base64,${(form as any).loginBgImageBase64})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      {((form as any).loginBgOverlay ?? 0) > 0 && (
                        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${(form as any).loginBgOverlay})` }} />
                      )}
                    </>
                  )}
                  {/* Login-Box (skaliert auf 65%) */}
                  {(() => {
                    const POSITIONS: Record<string, {j:string,a:string}> = {
                      'top-left': {j:'flex-start',a:'flex-start'}, 'top-center': {j:'center',a:'flex-start'}, 'top-right': {j:'flex-end',a:'flex-start'},
                      'middle-left': {j:'flex-start',a:'center'}, 'center': {j:'center',a:'center'}, 'middle-right': {j:'flex-end',a:'center'},
                      'bottom-left': {j:'flex-start',a:'flex-end'}, 'bottom-center': {j:'center',a:'flex-end'}, 'bottom-right': {j:'flex-end',a:'flex-end'},
                    }
                    const p = POSITIONS[(form as any).loginBoxPosition ?? 'center'] ?? {j:'center',a:'center'}
                    const logoSrcPrev = form.logoBase64 ? `data:${form.logoMimeType};base64,${form.logoBase64}` : null
                    const logoSz = Math.round(((form as any).loginLogoSize ?? 64) * 0.55)
                    const cardBgPrev = (form as any).loginCardBg ?? 'rgba(255,255,255,0.92)'
                    const cardBlurPrev = (form as any).loginCardBlur ?? 12
                    const cardRadiusPrev = Math.round(((form as any).loginCardRadius ?? 20) * 0.65)
                    const cardShadowPrev = (form as any).loginCardShadow ?? true
                    const hasBgPrev = !!(form as any).loginBgImageBase64
                    const offX = (form as any).loginBoxOffsetX ?? 0
                    const offY = (form as any).loginBoxOffsetY ?? 0
                    return (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: p.j, alignItems: p.a, padding: 16 }}>
                        <div style={{ transform: `translate(${offX*0.4}px, ${offY*0.4}px)`, width: 140 }}>
                          <div style={{ textAlign: 'center', marginBottom: 10 }}>
                            {logoSrcPrev ? (
                              <img src={logoSrcPrev} alt="" style={{ width: logoSz, height: logoSz, objectFit: 'contain', display: 'block', margin: '0 auto 5px' }} />
                            ) : (
                              <div style={{ width: logoSz, height: logoSz, borderRadius: logoSz * 0.22, background: form.colorPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 5px' }}>
                                <span style={{ color: 'white', fontSize: logoSz * 0.4, fontWeight: 700 }}>P</span>
                              </div>
                            )}
                            <div style={{ fontSize: 8, fontWeight: 700, color: hasBgPrev ? '#fff' : '#1e293b', textShadow: hasBgPrev ? '0 1px 3px rgba(0,0,0,0.4)' : 'none' }}>{form.praxisName}</div>
                            {form.slogan && <div style={{ fontSize: 6, color: hasBgPrev ? 'rgba(255,255,255,0.8)' : '#94a3b8' }}>{form.slogan}</div>}
                          </div>
                          <div style={{
                            background: cardBgPrev,
                            backdropFilter: cardBlurPrev > 0 ? `blur(${cardBlurPrev}px)` : undefined,
                            borderRadius: cardRadiusPrev,
                            padding: '10px 10px 8px',
                            boxShadow: cardShadowPrev ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',
                            border: '0.5px solid rgba(255,255,255,0.5)',
                          }}>
                            {/* Tab */}
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 6, padding: 2, marginBottom: 8, gap: 2 }}>
                              <div style={{ flex: 1, padding: '3px 0', borderRadius: 5, background: '#fff', fontSize: 5, textAlign: 'center', color: form.colorPrimary, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>E-Mail</div>
                              <div style={{ flex: 1, padding: '3px 0', fontSize: 5, textAlign: 'center', color: '#94a3b8' }}>PIN</div>
                            </div>
                            {['E-Mail-Adresse', 'Passwort'].map(lbl => (
                              <div key={lbl} style={{ marginBottom: 5 }}>
                                <div style={{ fontSize: 5, fontWeight: 600, color: '#475569', marginBottom: 2 }}>{lbl}</div>
                                <div style={{ height: 14, background: 'rgba(255,255,255,0.9)', borderRadius: 4, border: '0.5px solid rgba(0,0,0,0.12)' }} />
                              </div>
                            ))}
                            <div style={{ marginTop: 6, padding: '5px 0', borderRadius: 6, background: `linear-gradient(135deg, ${form.colorPrimary}, ${form.colorAccent})`, textAlign: 'center', fontSize: 5, color: 'white', fontWeight: 600 }}>
                              Anmelden
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>Wird nach dem Speichern auf der Login-Seite sichtbar</p>
              </div>
            </div>
          </div>

          {/* App-Typografie */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>App-Typografie</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Schriftgröße — {(form as any).appFontSize ?? 14}px</label>
                <input type="range" min={13} max={18} step={1}
                  value={(form as any).appFontSize ?? 14}
                  onChange={e => {
                    const sz = parseInt(e.target.value)
                    setForm(f => ({ ...f, appFontSize: sz } as any))
                    document.documentElement.style.setProperty('--font-size-base', sz + 'px')
                    document.documentElement.style.setProperty('--font-size-sm', (sz - 1) + 'px')
                    document.documentElement.style.setProperty('--font-size-xs', (sz - 2) + 'px')
                    document.documentElement.style.setProperty('--font-size-lg', (sz + 2) + 'px')
                  }}
                  style={{ width: '100%', accentColor: form.colorPrimary }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>Klein (13px)</span><span>Mittel (14px)</span><span>Groß (18px)</span>
                </div>
              </div>
              <div>
                <label className="label">Schriftart</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {([
                    ['system',    'System (Standard)',         '-apple-system, "Segoe UI", sans-serif'],
                    ['inter',     'Inter',                     '"Inter", -apple-system, sans-serif'],
                    ['georgia',   'Georgia',                   'Georgia, serif'],
                    ['palatino',  'Palatino',                  '"Palatino Linotype", Palatino, serif'],
                    ['optima',    'Optima',                    'Optima, Candara, sans-serif'],
                    ['gill-sans', 'Gill Sans',                 '"Gill Sans MT", "Gill Sans", Calibri, sans-serif'],
                  ] as [string,string,string][]).map(([key, label, stack]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: (form as any).appFontFamily === key ? form.colorPrimaryLight : 'var(--surface-page)', border: '0.5px solid var(--border)' }}>
                      <input type="radio" name="appFont" value={key}
                        checked={(form as any).appFontFamily === key}
                        onChange={() => {
                          setForm(f => ({ ...f, appFontFamily: key } as any))
                          document.documentElement.style.setProperty('--font-family', stack)
                        }} />
                      <span style={{ fontFamily: stack, fontSize: 14, color: (form as any).appFontFamily === key ? form.colorPrimary : 'var(--text-primary)', fontWeight: (form as any).appFontFamily === key ? 600 : 400 }}>
                        {label} — Beispieltext: Praxis Wutti
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rechte Spalte: Live-Vorschau Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Vorschau Sidebar</p>
            <div style={{ borderRadius: 14, border: "0.5px solid var(--border)", overflow: "hidden", background: "var(--surface-card)", '--color-primary': form.colorPrimary, '--color-primary-light': form.colorPrimaryLight } as any}>
              {/* Mini-Sidebar */}
              <div style={{ padding: 12, borderBottom: "0.5px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  {logoSrc ? (
                    <img src={logoSrc} alt="" className="w-7 h-7 rounded-lg object-contain" />
                  ) : (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                         style={{ backgroundColor: form.colorPrimary }}>
                      <span className="text-white text-xs font-bold">P</span>
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{form.praxisName}</p>
                    {form.slogan && <p style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{form.slogan}</p>}
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-0.5">
                {[
                  { label: 'Patienten', active: true },
                  { label: 'Branding & Praxis', active: false },
                  { label: 'Normwerte', active: false },
                ].map(item => (
                  <div key={item.label}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium"
                    style={item.active ? {
                      backgroundColor: form.colorPrimaryLight,
                      color: form.colorPrimary,
                    } : { color: '#64748b' }}>
                    <span className="w-3 h-3 rounded bg-current opacity-40" />
                    {item.label}
                  </div>
                ))}
              </div>
              <div style={{ padding: 8, borderTop: "0.5px solid var(--border)" }}>
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                       style={{ backgroundColor: form.colorPrimary }}>MM</div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Dr. M. Muster</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Therapeut/in</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Farbvorschau Button */}
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "0.5px solid var(--border)", background: "var(--surface-card)" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Button-Vorschau</p>
              <button
                className="w-full py-2 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: form.colorPrimary }}
              >
                Neuer Patient
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
