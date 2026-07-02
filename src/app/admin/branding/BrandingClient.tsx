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
            <div className="space-y-4">

              {/* Hintergrundbild Upload */}
              <div>
                <label className="label">Hintergrundbild</label>
                <div className="flex items-start gap-3">
                  <div style={{ width: 120, height: 70, borderRadius: 8, border: '0.5px solid var(--border)', overflow: 'hidden', background: (form as any).loginBgColor ?? 'var(--surface-page)', flexShrink: 0, position: 'relative' }}>
                    {(form as any).loginBgImageBase64 && (
                      <img src={`data:${(form as any).loginBgImageMime};base64,${(form as any).loginBgImageBase64}`}
                        alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {!(form as any).loginBgImageBase64 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: 'var(--text-muted)' }}>Kein Bild</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <input ref={loginBgRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={handleLoginBgUpload} />
                    <button onClick={() => loginBgRef.current?.click()} className="btn-secondary" style={{ fontSize: 12 }}>
                      <Upload className="w-3 h-3" /> Bild hochladen
                    </button>
                    {(form as any).loginBgImageBase64 && (
                      <button onClick={() => setForm(f => ({ ...f, loginBgImageBase64: null, loginBgImageMime: null } as any))} className="btn-ghost" style={{ fontSize: 12 }}>
                        <X className="w-3 h-3" /> Entfernen
                      </button>
                    )}
                    <div>
                      <label className="label" style={{ marginBottom: 2 }}>Fallback-Hintergrundfarbe</label>
                      <input type="color" value={(form as any).loginBgColor ?? '#f0f2f7'}
                        onChange={e => setForm(f => ({ ...f, loginBgColor: e.target.value } as any))}
                        style={{ width: 40, height: 28, border: 'none', padding: 2, cursor: 'pointer', borderRadius: 6 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Overlay */}
              {(form as any).loginBgImageBase64 && (
                <div>
                  <label className="label">Bild abdunkeln (Overlay) — {Math.round(((form as any).loginBgOverlay ?? 0) * 100)}%</label>
                  <input type="range" min={0} max={0.7} step={0.05}
                    value={(form as any).loginBgOverlay ?? 0}
                    onChange={e => setForm(f => ({ ...f, loginBgOverlay: parseFloat(e.target.value) } as any))}
                    style={{ width: '100%', accentColor: form.colorPrimary }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>Kein Overlay</span><span>Stark abgedunkelt</span>
                  </div>
                </div>
              )}

              {/* Login-Box-Position */}
              <div>
                <label className="label">Position des Login-Felds</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, maxWidth: 180 }}>
                  {([
                    ['top-left','↖'],['top-center','↑'],['top-right','↗'],
                    ['middle-left','←'],['center','·'],['middle-right','→'],
                    ['bottom-left','↙'],['bottom-center','↓'],['bottom-right','↘'],
                  ] as [string,string][]).map(([pos, icon]) => (
                    <button key={pos} onClick={() => setForm(f => ({ ...f, loginBoxPosition: pos } as any))}
                      style={{
                        padding: '8px 4px', borderRadius: 8, fontSize: 16, cursor: 'pointer',
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
