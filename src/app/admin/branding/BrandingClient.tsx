'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Upload, X, Palette, Building2, FileText, Eye } from 'lucide-react'
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
}

export function BrandingClient({ initial }: { initial: BrandingConfig }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ ...initial, bundesland: initial.bundesland ?? 'Kärnten' })
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
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      const [header, base64] = result.split(',')
      const mimeType = header.match(/data:(.+);/)?.[1] ?? 'image/png'
      setForm(f => ({ ...f, logoBase64: base64, logoMimeType: mimeType }))
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/admin/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
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
              <h2 className="font-semibold text-slate-700">Praxis-Informationen</h2>
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
              <h2 className="font-semibold text-slate-700">Logo</h2>
            </div>
            <div className="flex items-center gap-4">
              {logoSrc ? (
                <div className="relative">
                  <img src={logoSrc} alt="Logo" className="w-20 h-20 rounded-2xl object-contain border border-slate-200 p-2" />
                  <button
                    onClick={() => setForm(f => ({ ...f, logoBase64: null, logoMimeType: null }))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden" onChange={handleLogoUpload} />
                <button onClick={() => fileRef.current?.click()} className="btn-secondary">
                  <Upload className="w-4 h-4" /> Logo hochladen
                </button>
                <p className="text-xs text-slate-400 mt-1.5">PNG, SVG, JPG · max. 500 KB empfohlen</p>
              </div>
            </div>
          </div>

          {/* Farben */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 className="font-semibold text-slate-700">Farben</h2>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Farbpaletten</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-600 transition-all"
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
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      className="input font-mono text-xs"
                      value={(form as any)[key]}
                      onChange={e => set(key, e.target.value)}
                      maxLength={7}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Impressum */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: form.colorPrimary }} />
              <h2 className="font-semibold text-slate-700">Impressum / Über diese App</h2>
            </div>
            <label className="label">Inhalt (HTML erlaubt)</label>
            <textarea
              className="input font-mono text-xs"
              rows={6}
              value={form.imprintHtml ?? ''}
              onChange={e => set('imprintHtml', e.target.value)}
              placeholder="<p>Betreiber: Dr. Max Mustermann ...</p>"
            />
            <p className="text-xs text-slate-400 mt-1">Wird auf der Seite /impressum angezeigt</p>
          </div>
        </div>

        {/* Rechte Spalte: Live-Vorschau Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Vorschau Sidebar</p>
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-lg bg-white"
                 style={{ '--color-primary': form.colorPrimary, '--color-primary-light': form.colorPrimaryLight } as any}>
              {/* Mini-Sidebar */}
              <div className="p-3 border-b border-slate-100">
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
                    <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">{form.praxisName}</p>
                    {form.slogan && <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{form.slogan}</p>}
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
              <div className="p-2 border-t border-slate-100">
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                       style={{ backgroundColor: form.colorPrimary }}>MM</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Dr. M. Muster</p>
                    <p className="text-[10px] text-slate-400">Therapeut/in</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Farbvorschau Button */}
            <div className="mt-4 p-3 rounded-xl border border-slate-200 bg-white">
              <p className="text-xs font-medium text-slate-400 mb-2">Button-Vorschau</p>
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
