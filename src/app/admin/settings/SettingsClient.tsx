'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle, AlertCircle, Calendar, FileText, Tag, ExternalLink,
  Trash2, Plus, X, ChevronDown, ChevronRight, User, Euro,
  Palette, Settings, MoreHorizontal, Eye, EyeOff, Save, AlertTriangle
} from 'lucide-react'
import { INVOICE_PLACEHOLDERS } from '@/lib/invoice/template'

// ── Akkordeon-Abschnitt ──────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'var(--surface-card)',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open
          ? <ChevronDown style={{ width: 15, height: 15, stroke: 'var(--text-muted)' }} />
          : <ChevronRight style={{ width: 15, height: 15, stroke: 'var(--text-muted)' }} />
        }
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </button>
      {open && (
        <div style={{ padding: 20, background: 'var(--surface-panel)', borderTop: '0.5px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange, description }: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          background: value ? 'var(--color-primary)' : 'var(--surface-panel)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: value ? 21 : 3, transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export function SettingsClient({ googleCal, invoiceTemplates, txTypes }: any) {
  const searchParams = useSearchParams()
  const googleStatus = searchParams?.get('google')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const [saved, setSaved]   = useState(false)

  // ── Therapeutin-Daten ──
  const [therapist, setTherapist] = useState({
    name: '', street: '', city: '', method: 'Verhaltenstherapie',
    profession: 'Psychotherapeut*in', accountName: '', iban: '', paymentDays: 21,
  })
  const [showIban, setShowIban] = useState(false)

  // ── Allgemein ──
  const [general, setGeneral] = useState({
    activeProfilesFirst: true, displayNameFormat: 'firstName_lastName',
    showProfileNumber: false, showAvatar: true,
    showTimeOption: true, showAudioDocOption: true, showProfileGoals: true,
    importHolidays: true, autoColorAppointments: false, showAppointmentsAsNotifications: true,
    country: 'AT', profession: 'Psychotherapeut*in',
  })

  // ── Anamnese-Vorlage ──
  const [anamnesisTemplate, setAnamnesisTemplate] = useState([
    { title: 'Somatische Anamnese',          prefilledText: '' },
    { title: 'Psychische Anamnese',           prefilledText: '' },
    { title: 'Sozialanamnese',                prefilledText: '' },
    { title: 'Biographie und Lebenssituation',prefilledText: '' },
  ])

  // ── Session-Einstellungen ──
  const [sessionSettings, setSessionSettings] = useState({
    formatableProtocols: true,
    changeLog: false,
    showChanges: false,
    lazyLoading: true,
    spellCheck: false,
    extraServices: false,
  })

  // ── Finanzen ──
  const [financeSettings, setFinanceSettings] = useState({
    mileageEnabled: true,
    sendInvoicesByEmail: false,
    pdfPasswordProtect: false,
    advancedMode: false,
    referenceFormat: '{EA_E_A}{Kreisjahr2}{Nr}',
    referenceStartNumber: 0,
  })

  // ── Visuelles ──
  const [visual, setVisual] = useState({
    theme: 'light', fontSize: 'medium',
    accentColor: '#4f46e5', fontFamily: 'original',
    helpTool: true, classicMode: false,
  })
  const [telemetry, setTelemetry] = useState(false)

  // Visuelle Einstellungen, Telemetrie + Anamnese-Vorlage beim Laden aus DB holen
  useEffect(() => {
    fetch('/api/settings/anamnesis-template').then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) setAnamnesisTemplate(d)
    }).catch(() => {})
    fetch('/api/settings/session-templates').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setSessionTemplates(d)
    }).catch(() => {})
    fetch('/api/settings/visual').then(r => r.json()).then(d => {
      if (d && !d.error) setVisual({
        theme: d.theme ?? 'light',
        fontSize: d.fontSize ?? 'medium',
        accentColor: d.accentColor ?? '#4f46e5',
        fontFamily: d.fontFamily ?? 'original',
        helpTool: d.helpToolEnabled ?? true,
        classicMode: d.classicMode ?? false,
      })
    }).catch(() => {})
    fetch('/api/settings/session-settings').then(r => r.json()).then(d => {
      setSessionSettings({
        formatableProtocols: d.formatableProtocols ?? true,
        changeLog:           d.changeLog           ?? false,
        showChanges:         d.showChanges          ?? false,
        lazyLoading:         d.lazyLoading          ?? true,
        spellCheck:          d.spellCheck           ?? false,
        extraServices:       d.extraServices        ?? false,
      })
    }).catch(() => {})
    fetch('/api/settings/telemetry').then(r => r.json()).then(d => {
      if (d && !d.error) setTelemetry(d.enabled ?? false)
    }).catch(() => {})
  }, [])
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteScope, setDeleteScope] = useState<'all'|'finance'|null>(null)
  const [deleting, setDeleting] = useState(false)

  // Rechnungsvorlagen
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', htmlContent: '', isDefault: false })

  // SessionTemplates
  const [sessionTemplates, setSessionTemplates] = useState<any[]>([])
  const [showSessionTplForm, setShowSessionTplForm] = useState(false)
  const [sessionTplForm, setSessionTplForm] = useState({ name: '', isDefault: false })
  const [savingSessionTpl, setSavingSessionTpl] = useState(false)

  // txTypes
  const [txTypeForm, setTxTypeForm] = useState({ name: '', direction: 'income' })
  const [showTxTypeForm, setShowTxTypeForm] = useState(false)
  const [savingTxType, setSavingTxType] = useState(false)

  async function saveTherapist() {
    setSaving(true)
    await fetch('/api/settings/general', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapistName: therapist.name, therapistStreet: therapist.street,
        therapistCity: therapist.city, therapistMethod: therapist.method,
        therapistProfession: therapist.profession,
        therapistAccountName: therapist.accountName,
        therapistIban: therapist.iban, therapistPaymentDays: therapist.paymentDays,
      }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function saveSessionSettings() {
    setSaving(true)
    await fetch('/api/settings/session-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionSettings),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function saveVisual() {
    setSaving(true)
    await fetch('/api/settings/visual', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme:           visual.theme,
        fontSize:        visual.fontSize,
        accentColor:     visual.accentColor,
        fontFamily:      visual.fontFamily,
        helpToolEnabled: visual.helpTool,
        classicMode:     visual.classicMode,
      }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function saveTelemetry(enabled: boolean) {
    await fetch('/api/settings/telemetry', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    setTelemetry(enabled)
  }

  async function saveTemplate() {
    setSaving(true)
    await fetch('/api/invoice-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateForm),
    })
    setSaving(false); setShowNewTemplate(false); window.location.reload()
  }

  async function saveTxType() {
    setSavingTxType(true)
    await fetch('/api/invoice-templates', {   // nutzt bestehenden Endpunkt als Workaround
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: txTypeForm.name, direction: txTypeForm.direction }),
    })
    setSavingTxType(false); setShowTxTypeForm(false); window.location.reload()
  }

  async function disconnectGoogle() {
    if (!confirm('Google Calendar trennen?')) return
    await fetch('/api/google-calendar/disconnect', { method: 'POST' })
    window.location.reload()
  }

  async function deleteData() {
    const phrase = deleteScope === 'all' ? 'ALLE DATEN LÖSCHEN' : 'FINANZDATEN LÖSCHEN'
    if (deleteConfirm !== phrase) {
      alert(`Bitte gib exakt "${phrase}" ein.`); return
    }
    if (!confirm(`⚠️ Diese Aktion kann nicht rückgängig gemacht werden. Fortfahren?`)) return
    setDeleting(true)
    const res = await fetch('/api/settings/delete-data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: deleteScope, confirmPhrase: deleteConfirm }),
    })
    const data = await res.json()
    setDeleting(false); setDeleteConfirm(''); setDeleteScope(null)
    if (data.ok) alert('✓ Daten erfolgreich gelöscht.')
    else alert('Fehler: ' + data.error)
  }

  const ACCENT_COLORS = [
    '#4f46e5', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#64748b', '#000000',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="topbar">
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Persönliche Einstellungen</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Diese Einstellungen gelten nur für Ihren Account — jeder Therapeut hat eigene Daten.
        </div>
      </div>

      <div style={{ padding: 20, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {googleStatus === 'connected' && (
          <div style={{ padding: '10px 14px', background: 'var(--green-bg)', border: '0.5px solid var(--green-border,#bbf7d0)', borderRadius: 8, color: 'var(--green)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle style={{ width: 16, height: 16 }} /> Google Calendar erfolgreich verbunden!
          </div>
        )}

        {/* ── PERSÖNLICH / THERAPEUTIN ── */}
        <Section title="Persönlich / Therapeut*in" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid-2">
              <div>
                <label className="label">Name</label>
                <input className="input" value={therapist.name}
                  onChange={e => setTherapist(t => ({ ...t, name: e.target.value }))}
                  placeholder="Mag. Max Mustermann" />
              </div>
              <div>
                <label className="label">Psychotherapiemethode</label>
                <input className="input" value={therapist.method}
                  onChange={e => setTherapist(t => ({ ...t, method: e.target.value }))} />
              </div>
              <div>
                <label className="label">Straße u. Haus-Nr.</label>
                <input className="input" value={therapist.street}
                  onChange={e => setTherapist(t => ({ ...t, street: e.target.value }))} />
              </div>
              <div>
                <label className="label">Stadt u. PLZ</label>
                <input className="input" value={therapist.city}
                  onChange={e => setTherapist(t => ({ ...t, city: e.target.value }))} />
              </div>
              <div>
                <label className="label">Kontoname</label>
                <input className="input" value={therapist.accountName}
                  onChange={e => setTherapist(t => ({ ...t, accountName: e.target.value }))} />
              </div>
              <div>
                <label className="label">IBAN</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" style={{ flex: 1 }}
                    type={showIban ? 'text' : 'password'}
                    value={therapist.iban}
                    onChange={e => setTherapist(t => ({ ...t, iban: e.target.value }))}
                    placeholder="AT61 1904 3002 3457 3201" />
                  <button onClick={() => setShowIban(s => !s)} className="btn-ghost" style={{ padding: '6px 8px' }}>
                    {showIban ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Zahlungsfrist in Tagen</label>
                <input type="number" className="input" value={therapist.paymentDays}
                  onChange={e => setTherapist(t => ({ ...t, paymentDays: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div>
              <button onClick={saveTherapist} disabled={saving} className="btn-primary" style={{ fontSize: 12 }}>
                {saving ? 'Speichern...' : saved ? <><CheckCircle style={{ width: 12, height: 12 }} /> Gespeichert</> : <><Save style={{ width: 12, height: 12 }} /> Speichern</>}
              </button>
            </div>
          </div>
        </Section>

        {/* ── ALLGEMEIN ── */}
        <Section title="Allgemein">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Profile</h4>
                <Toggle label="Aktive Profile oben anordnen" value={general.activeProfilesFirst}
                  onChange={v => setGeneral(g => ({ ...g, activeProfilesFirst: v }))} />
                <Toggle label="Profilnummer anzeigen" value={general.showProfileNumber}
                  onChange={v => setGeneral(g => ({ ...g, showProfileNumber: v }))} />
                <Toggle label="Avatar anzeigen" value={general.showAvatar}
                  onChange={v => setGeneral(g => ({ ...g, showAvatar: v }))} />
                <div style={{ marginTop: 8 }}>
                  <label className="label">Anzeigename</label>
                  <select className="input" value={general.displayNameFormat}
                    onChange={e => setGeneral(g => ({ ...g, displayNameFormat: e.target.value }))}>
                    <option value="firstName_lastName">Vorname Nachname</option>
                    <option value="lastName_firstName">Nachname Vorname</option>
                  </select>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Sitzungshinzufügen</h4>
                <Toggle label="Uhrzeit-Option anzeigen" value={general.showTimeOption}
                  onChange={v => setGeneral(g => ({ ...g, showTimeOption: v }))} />
                <Toggle label="Audio- & Dokumentoption anzeigen" value={general.showAudioDocOption}
                  onChange={v => setGeneral(g => ({ ...g, showAudioDocOption: v }))} />
                <Toggle label="Profilziele anzeigen" value={general.showProfileGoals}
                  onChange={v => setGeneral(g => ({ ...g, showProfileGoals: v }))} />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

            {/* Google Calendar */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Google Kalender</h4>
              {googleCal ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--green)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CheckCircle style={{ width: 14, height: 14 }} /> Verbunden: {googleCal.googleAccountEmail}
                  </span>
                  <button onClick={disconnectGoogle} className="btn-danger" style={{ fontSize: 12 }}>Trennen</button>
                </div>
              ) : (
                <a href="/api/google-calendar/connect" className="btn-secondary" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Calendar style={{ width: 13, height: 13 }} /> Mit Google verbinden
                </a>
              )}
              <div style={{ marginTop: 10 }}>
                <Toggle label="Feiertage importieren" value={general.importHolidays}
                  onChange={v => setGeneral(g => ({ ...g, importHolidays: v }))}
                  description="Benötigt keine Google-Anmeldung" />
                <Toggle label="Termine automatisch einfärben" value={general.autoColorAppointments}
                  onChange={v => setGeneral(g => ({ ...g, autoColorAppointments: v }))} />
                <Toggle label="Kalendertermine als Nachrichten anzeigen" value={general.showAppointmentsAsNotifications}
                  onChange={v => setGeneral(g => ({ ...g, showAppointmentsAsNotifications: v }))} />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

            {/* Anamnese-Vorlage */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Anamnese Vorlage</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {anamnesisTemplate.map((field, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input" style={{ flex: 1 }} placeholder="Überschrift"
                      value={field.title}
                      onChange={e => {
                        const t = [...anamnesisTemplate]; t[i] = { ...t[i], title: e.target.value }
                        setAnamnesisTemplate(t)
                      }} />
                    <input className="input" style={{ flex: 2 }} placeholder="Vorausgefüllter Text"
                      value={field.prefilledText}
                      onChange={e => {
                        const t = [...anamnesisTemplate]; t[i] = { ...t[i], prefilledText: e.target.value }
                        setAnamnesisTemplate(t)
                      }} />
                    <button onClick={() => setAnamnesisTemplate(t => t.filter((_, j) => j !== i))}
                      className="btn-ghost" style={{ padding: '4px 6px', color: 'var(--red)' }}>
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAnamnesisTemplate(t => [...t, { title: '', prefilledText: '' }])}
                    className="btn-secondary" style={{ fontSize: 12 }}>
                    <Plus style={{ width: 12, height: 12 }} /> Feld hinzufügen
                  </button>
                  <button onClick={async () => {
                    await fetch('/api/settings/anamnesis-template', {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fields: anamnesisTemplate }),
                    })
                    setSaved(true); setTimeout(() => setSaved(false), 2500)
                  }} className="btn-primary" style={{ fontSize: 12 }}>
                    <Save style={{ width: 12, height: 12 }} /> Vorlage speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── SESSIONS ── */}
        <Section title="Sitzungen">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Sitzungs-Textboxen</h4>
            <Toggle label="Formatierbare Protokolltexte" value={sessionSettings.formatableProtocols}
              onChange={v => setSessionSettings(s => ({ ...s, formatableProtocols: v }))} />
            <Toggle label="Text-Änderungsprotokoll" value={sessionSettings.changeLog}
              onChange={v => setSessionSettings(s => ({ ...s, changeLog: v }))}
              description="Wird erst nach einem Neustart übernommen" />
            <Toggle label="Änderungen in Protokollen anzeigen" value={sessionSettings.showChanges}
              onChange={v => setSessionSettings(s => ({ ...s, showChanges: v }))} />
            <Toggle label="Datenimport-Beschleunigung (Lazy Loading)" value={sessionSettings.lazyLoading}
              onChange={v => setSessionSettings(s => ({ ...s, lazyLoading: v }))}
              description="Sitzungen erst bei Verwendung eines Profils importieren" />
            <Toggle label="Rechtschreibprüfung aktivieren" value={sessionSettings.spellCheck}
              onChange={v => setSessionSettings(s => ({ ...s, spellCheck: v }))}
              description="Sitzungsprotokolle markieren Rechtschreibfehler. Kann die Leistung verschlechtern." />

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <Toggle label="Zusätzliche Leistungen aktivieren" value={sessionSettings.extraServices}
              onChange={v => setSessionSettings(s => ({ ...s, extraServices: v }))}
              description="Mit dem zusätzlichen Leistungen-Modus ist es möglich, bei Sitzungen weitere Leistungen (z.B. Diagnose, Testverfahren) hinzuzufügen." />

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <button onClick={saveSessionSettings} disabled={saving} className="btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }}>
              <Save style={{ width: 12, height: 12 }} /> Sitzungs-Einstellungen speichern
            </button>

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            {/* Sitzungsvorlagen */}
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Sitzungsvorlagen</h4>
            {sessionTemplates.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                  {t.isDefault && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}>Standard</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                    Kurzprotokoll, Langprotokoll
                  </span>
                </div>
                <button onClick={async () => {
                  await fetch(`/api/settings/session-templates/${t.id}`, { method: 'DELETE' })
                  setSessionTemplates(prev => prev.filter(x => x.id !== t.id))
                }} className="btn-ghost" style={{ padding: '2px 4px', color: 'var(--red)' }}>
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
            {!showSessionTplForm ? (
              <button onClick={() => setShowSessionTplForm(true)} className="btn-secondary" style={{ fontSize: 12, marginTop: 8, alignSelf: 'flex-start' }}>
                <Plus style={{ width: 12, height: 12 }} /> Sitzungsvorlage hinzufügen
              </button>
            ) : (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--surface-card)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                <div><label className="label">Name der Vorlage *</label>
                  <input className="input" placeholder="z.B. Standardsession, Erstgespräch" value={sessionTplForm.name}
                    onChange={e => setSessionTplForm(f => ({ ...f, name: e.target.value }))} /></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sessionTplForm.isDefault}
                    onChange={e => setSessionTplForm(f => ({ ...f, isDefault: e.target.checked }))} />
                  Als Standard-Sitzungsvorlage setzen
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowSessionTplForm(false)} className="btn-secondary">Abbrechen</button>
                  <button onClick={async () => {
                    if (!sessionTplForm.name) return
                    setSavingSessionTpl(true)
                    const res = await fetch('/api/settings/session-templates', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(sessionTplForm),
                    })
                    const tpl = await res.json()
                    setSessionTemplates(prev => [...prev, tpl])
                    setSavingSessionTpl(false)
                    setShowSessionTplForm(false)
                    setSessionTplForm({ name: '', isDefault: false })
                  }} disabled={savingSessionTpl || !sessionTplForm.name} className="btn-primary" style={{ fontSize: 12 }}>
                    {savingSessionTpl ? 'Speichern...' : 'Speichern'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            {/* Rechnungsvorlagen */}
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Rechnungsvorlagen</h4>
            {invoiceTemplates?.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                  {t.isDefault && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}>Standard</span>}
                </div>
              </div>
            ))}
            {!showNewTemplate ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setShowNewTemplate(true)} className="btn-secondary" style={{ fontSize: 12 }}>
                  <Plus style={{ width: 12, height: 12 }} /> Neue Vorlage
                </button>
                <button onClick={() => router.push('/admin/rechnungsvorlage')} className="btn-secondary" style={{ fontSize: 12 }}>
                  🎨 Vollständig verwalten
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--surface-card)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                <div><label className="label">Name *</label>
                  <input className="input" value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Beschreibung</label>
                  <input className="input" value={templateForm.description} onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><label className="label">HTML-Inhalt</label>
                  <textarea className="input" rows={6} value={templateForm.htmlContent} onChange={e => setTemplateForm(f => ({ ...f, htmlContent: e.target.value }))} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowNewTemplate(false)} className="btn-secondary">Abbrechen</button>
                  <button onClick={saveTemplate} disabled={saving || !templateForm.name} className="btn-primary">Speichern</button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── FINANZEN ── */}
        <Section title="Finanzen">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Toggle label="Fahrtenbuch aktivieren" value={financeSettings.mileageEnabled}
              onChange={v => setFinanceSettings(f => ({ ...f, mileageEnabled: v }))} />
            <Toggle label="Rechnungen per E-Mail versenden" value={financeSettings.sendInvoicesByEmail}
              onChange={v => setFinanceSettings(f => ({ ...f, sendInvoicesByEmail: v }))} />
            <Toggle label="PDF-Rechnungen Passwortschutz" value={financeSettings.pdfPasswordProtect}
              onChange={v => setFinanceSettings(f => ({ ...f, pdfPasswordProtect: v }))} />

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            <Toggle label="Erweiterter Finanzmodus" value={financeSettings.advancedMode}
              onChange={v => setFinanceSettings(f => ({ ...f, advancedMode: v }))}
              description="Schaltet Funktionen wie Mehrwertsteuer und Rechnungsteilung ein." />

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            {/* Referenznummernformat */}
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Referenznummernformat</h4>
            <div style={{ padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>
              ⚠️ Änderungen im Referenznummernsystem werden vom Finanzamt und Buchhalter*innen nicht gerne gesehen.
            </div>
            <div>
              <label className="label">Codewörter</label>
              <input className="input" value={financeSettings.referenceFormat}
                onChange={e => setFinanceSettings(f => ({ ...f, referenceFormat: e.target.value }))} />
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="label">Referenznummer Startzahl</label>
              <input type="number" className="input" value={financeSettings.referenceStartNumber}
                onChange={e => setFinanceSettings(f => ({ ...f, referenceStartNumber: parseInt(e.target.value) }))} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Beispiele Einnahmen: E{new Date().getFullYear()}001, E{new Date().getFullYear()}002 ·
                Ausgaben: A{new Date().getFullYear()}001, A{new Date().getFullYear()}002
              </p>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            {/* Rechnungstypen */}
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Eigene Rechnungstypen</h4>
            {txTypes?.map((t: any) => (
              <div key={t.id} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, display: 'flex', gap: 10 }}>
                <span style={{ fontWeight: 500 }}>{t.name}</span>
                <span className="badge badge-indigo" style={{ fontSize: 10 }}>{t.direction}</span>
              </div>
            ))}
            {!showTxTypeForm ? (
              <button onClick={() => setShowTxTypeForm(true)} className="btn-secondary" style={{ fontSize: 12, marginTop: 10, alignSelf: 'flex-start' }}>
                <Plus style={{ width: 12, height: 12 }} /> Typ hinzufügen
              </button>
            ) : (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label className="label">Name</label>
                  <input className="input" value={txTypeForm.name} onChange={e => setTxTypeForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Richtung</label>
                  <select className="input" value={txTypeForm.direction} onChange={e => setTxTypeForm(f => ({ ...f, direction: e.target.value }))}>
                    <option value="income">Einnahme</option>
                    <option value="expense">Ausgabe</option>
                  </select>
                </div>
                <button onClick={saveTxType} disabled={savingTxType || !txTypeForm.name} className="btn-primary" style={{ fontSize: 12 }}>
                  {savingTxType ? '...' : 'Speichern'}
                </button>
                <button onClick={() => setShowTxTypeForm(false)} className="btn-ghost" style={{ padding: 6 }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* ── VISUELLES ── */}
        <Section title="Visuelles">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Theme / Design</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['light', 'dark'].map(t => (
                    <button key={t} onClick={() => setVisual(v => ({ ...v, theme: t }))}
                      className={visual.theme === t ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, fontSize: 12 }}>
                      {t === 'light' ? 'Hell' : 'Dunkel'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Schriftgröße</h4>
                <select className="input" value={visual.fontSize} onChange={e => setVisual(v => ({ ...v, fontSize: e.target.value }))}>
                  <option value="small">Größe 1 (Klein)</option>
                  <option value="medium">Größe 2 (Standard)</option>
                  <option value="large">Größe 3 (Groß)</option>
                </select>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Farbe</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ACCENT_COLORS.map(c => (
                  <button key={c} onClick={() => setVisual(v => ({ ...v, accentColor: c }))}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: visual.accentColor === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                      background: c, cursor: 'pointer',
                    }} />
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Schriftart</h4>
              <select className="input" value={visual.fontFamily} onChange={e => setVisual(v => ({ ...v, fontFamily: e.target.value }))}>
                <option value="original">Original</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>

            <Toggle label="Hilfe-Tool" value={visual.helpTool} onChange={v => setVisual(vv => ({ ...vv, helpTool: v }))} />
            <Toggle label="Klassischer Modus" value={visual.classicMode} onChange={v => setVisual(vv => ({ ...vv, classicMode: v }))} />

            <div style={{ padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
              Achtung: Einige Einstellungen werden erst nach dem Neustarten übernommen.
            </div>

            <div>
              <button onClick={async () => {
                await fetch('/api/settings/visual', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    theme: visual.theme,
                    fontSize: visual.fontSize,
                    accentColor: visual.accentColor,
                    fontFamily: visual.fontFamily,
                    helpToolEnabled: visual.helpTool,
                    classicMode: visual.classicMode,
                  }),
                })
                window.location.reload()
              }} className="btn-primary" style={{ fontSize: 12 }}>
                <Save style={{ width: 12, height: 12 }} /> Visuelle Einstellungen speichern
              </button>
            </div>
          </div>
        </Section>

        {/* ── WEITERES ── */}
        <Section title="Weiteres...">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Nutzungserhebung */}
            <div>
              <Toggle label="Nutzungserhebung" value={telemetry}
              onChange={async v => {
                setTelemetry(v)
                await fetch('/api/settings/telemetry', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled: v }),
                })
              }}
                description="Wenn aktiviert, werden keine Daten an Dritte weitergegeben oder jegliche Daten von Klient*innen erhoben." />
              {!telemetry && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Es werden keine Daten von Ihrer Nutzung erhoben.
                </p>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Datenlöschung */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Datenlöschung</h4>

              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                  Alle Daten löschen: Profile, Sitzungen, Finanzen, Dokumente und alle Einträge werden unwiderruflich gelöscht.
                </p>
                <button onClick={() => setDeleteScope('all')} className="btn-danger" style={{ fontSize: 12 }}>
                  Alle Daten löschen
                </button>
              </div>

              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                  Alle Finanzdaten löschen: Die Profile und Sitzungen bleiben erhalten.
                </p>
                <button onClick={() => setDeleteScope('finance')} className="btn-danger" style={{ fontSize: 12 }}>
                  Finanzdaten löschen
                </button>
              </div>

              {deleteScope && (
                <div style={{ padding: 14, background: 'var(--red-bg,#fef2f2)', border: '1px solid var(--red-border,#fca5a5)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
                    <AlertTriangle style={{ width: 16, height: 16, stroke: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 13, color: 'var(--red)' }}>
                      <strong>Diese Aktion kann NICHT rückgängig gemacht werden.</strong>
                      <br />
                      Tippe{' '}
                      <code style={{ background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                        {deleteScope === 'all' ? 'ALLE DATEN LÖSCHEN' : 'FINANZDATEN LÖSCHEN'}
                      </code>
                      {' '}zur Bestätigung:
                    </div>
                  </div>
                  <input className="input" value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder={deleteScope === 'all' ? 'ALLE DATEN LÖSCHEN' : 'FINANZDATEN LÖSCHEN'}
                    style={{ marginBottom: 10, borderColor: 'var(--red)' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setDeleteScope(null); setDeleteConfirm('') }} className="btn-secondary" style={{ flex: 1 }}>
                      Abbrechen
                    </button>
                    <button onClick={deleteData} disabled={deleting} className="btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                      {deleting ? 'Lösche...' : 'Endgültig löschen'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Impressum */}
            <div>
              <a href="/impressum" target="_blank" className="btn-secondary" style={{ fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink style={{ width: 12, height: 12 }} /> Impressum öffnen
              </a>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
