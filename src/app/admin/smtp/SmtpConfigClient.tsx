'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Send, Check, AlertCircle, Eye, EyeOff, ChevronRight } from 'lucide-react'

const PROVIDERS = [
  {
    key: 'gmail',
    label: 'Gmail',
    icon: '📧',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    hint: 'Verwende ein App-Passwort (nicht dein Google-Passwort). Google-Konto → Sicherheit → App-Passwörter.',
  },
  {
    key: 'office365',
    label: 'Office 365 / Outlook',
    icon: '📨',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    hint: 'Verwende deine Office 365 E-Mail-Adresse und dein Passwort. Aktiviere "SMTP AUTH" im Exchange Admin Center.',
  },
  {
    key: 'ionos',
    label: 'IONOS / 1&1',
    icon: '🌐',
    host: 'smtp.ionos.at',
    port: 587,
    secure: false,
    hint: 'IONOS Hosting: smtp.ionos.at Port 587 (STARTTLS) oder Port 465 (SSL).',
  },
  {
    key: 'custom',
    label: 'Eigener Server',
    icon: '🔧',
    host: '',
    port: 587,
    secure: false,
    hint: 'Gib die Verbindungsdaten deines Mailservers ein.',
  },
]

export function SmtpConfigClient({
  initialConfig,
  adminEmail,
}: {
  initialConfig: any | null
  adminEmail: string
}) {
  const router = useRouter()

  const [provider, setProvider] = useState(initialConfig?.provider ?? 'gmail')
  const [form, setForm] = useState({
    host:      initialConfig?.host ?? 'smtp.gmail.com',
    port:      initialConfig?.port ?? 587,
    secure:    initialConfig?.secure ?? false,
    user:      initialConfig?.user ?? '',
    password:  '',
    fromName:  initialConfig?.fromName ?? 'KDS Praxis',
    fromEmail: initialConfig?.fromEmail ?? '',
    replyTo:   initialConfig?.replyTo ?? '',
  })
  const [showPassword, setShowPassword]   = useState(false)
  const [saving,       setSaving]         = useState(false)
  const [saved,        setSaved]          = useState(false)
  const [saveError,    setSaveError]      = useState('')
  const [testEmail,    setTestEmail]      = useState(adminEmail)
  const [testing,      setTesting]        = useState(false)
  const [testResult,   setTestResult]     = useState<{ ok: boolean; error?: string } | null>(null)
  const [lastTested,   setLastTested]     = useState<{ at: string; ok: boolean } | null>(
    initialConfig?.lastTestedAt
      ? { at: new Date(initialConfig.lastTestedAt).toLocaleString('de-AT'), ok: initialConfig.lastTestOk }
      : null
  )

  const selectedProvider = PROVIDERS.find(p => p.key === provider) ?? PROVIDERS[3]

  function selectProvider(p: typeof PROVIDERS[0]) {
    setProvider(p.key)
    if (p.host) {
      setForm(f => ({ ...f, host: p.host, port: p.port, secure: p.secure }))
    }
  }

  async function save() {
    setSaving(true); setSaveError(''); setSaved(false)
    try {
      const res = await fetch('/api/admin/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setSaveError(e.message)
    }
    setSaving(false)
  }

  async function sendTest() {
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail }),
      })
      const data = await res.json()
      setTestResult(data)
      if (data.ok) setLastTested({ at: new Date().toLocaleString('de-AT'), ok: true })
      else setLastTested({ at: new Date().toLocaleString('de-AT'), ok: false })
    } catch {
      setTestResult({ ok: false, error: 'Netzwerkfehler' })
    }
    setTesting(false)
  }

  const inp = {
    style: {
      width: '100%', padding: '8px 10px', fontSize: 13,
      border: '0.5px solid var(--border)', borderRadius: 7,
      background: 'var(--surface-page)', color: 'var(--text-primary)',
      boxSizing: 'border-box' as const,
    }
  }
  const lbl = { style: { fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)', display: 'block', marginBottom: 4 } }
  const sec = { style: { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push('/admin/settings')} className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Administration
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>E-Mail / SMTP</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveError && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{saveError}</span>}
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><Check style={{ width: 13, height: 13 }} />Gespeichert</span>}
          <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            <Save style={{ width: 13, height: 13 }} />{saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 28, background: 'var(--surface-page)' }}>
        <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Anbieter-Auswahl */}
          <div>
            <div {...sec}>E-Mail-Anbieter</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PROVIDERS.map(p => (
                <button key={p.key} onClick={() => selectProvider(p)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: `1.5px solid ${provider === p.key ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: provider === p.key ? 'var(--color-primary-light)' : 'var(--surface-card)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}>
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: provider === p.key ? 'var(--color-primary)' : 'var(--text-primary)' }}>{p.label}</span>
                </button>
              ))}
            </div>
            {selectedProvider.hint && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--color-primary-light)', borderRadius: 8, fontSize: 12, color: 'var(--color-primary)', lineHeight: 1.6 }}>
                💡 {selectedProvider.hint}
              </div>
            )}
          </div>

          {/* Verbindung */}
          <div>
            <div {...sec}>Verbindung</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label {...lbl}>SMTP-Host *</label>
                  <input {...inp} value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label {...lbl}>Port *</label>
                  <input type="number" {...inp} value={form.port} onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 587 }))} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-card)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.secure} onChange={e => setForm(f => ({ ...f, secure: e.target.checked }))} />
                <span>SSL/TLS verwenden (Port 465)</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>— STARTTLS (Port 587) ist Standard</span>
              </label>
            </div>
          </div>

          {/* Zugangsdaten */}
          <div>
            <div {...sec}>Zugangsdaten</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label {...lbl}>Benutzername (E-Mail-Adresse) *</label>
                <input {...inp} value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="praxis@gmail.com" autoComplete="off" />
              </div>
              <div>
                <label {...lbl}>
                  Passwort / App-Passwort *
                  {initialConfig?.passwordSet && <span style={{ marginLeft: 6, color: 'var(--green)', fontWeight: 400 }}>✓ gesetzt — leer lassen um beizubehalten</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input {...inp}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={initialConfig?.passwordSet ? '••••••••••••' : 'App-Passwort eingeben'}
                    autoComplete="new-password"
                    style={{ ...inp.style, paddingRight: 40 }}
                  />
                  <button onClick={() => setShowPassword(s => !s)} type="button"
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                    {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Absender */}
          <div>
            <div {...sec}>Absender</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label {...lbl}>Anzeigename *</label>
                  <input {...inp} value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} placeholder="Psychotherapeutische Praxis Wutti" />
                </div>
                <div>
                  <label {...lbl}>Absender-E-Mail *</label>
                  <input {...inp} value={form.fromEmail} onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))} placeholder="praxis@meinedomain.at" />
                </div>
              </div>
              <div>
                <label {...lbl}>Antwort-Adresse (Reply-To, optional)</label>
                <input {...inp} value={form.replyTo} onChange={e => setForm(f => ({ ...f, replyTo: e.target.value }))} placeholder="Wenn leer: Absender-E-Mail" />
              </div>
            </div>
          </div>

          {/* Testmail */}
          <div style={{ padding: 16, background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)' }}>
            <div {...sec}>Verbindung testen</div>
            {lastTested && (
              <div style={{ marginBottom: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: lastTested.ok ? 'var(--green)' : 'var(--red)' }}>
                {lastTested.ok ? <Check style={{ width: 13, height: 13 }} /> : <AlertCircle style={{ width: 13, height: 13 }} />}
                Letzter Test: {lastTested.at} — {lastTested.ok ? 'Erfolgreich' : 'Fehlgeschlagen'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input {...inp} style={{ ...inp.style, flex: 1 }} value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" type="email" />
              <button onClick={sendTest} disabled={testing || !testEmail} className="btn-secondary" style={{ fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Send style={{ width: 13, height: 13 }} />{testing ? 'Sende...' : 'Testmail senden'}
              </button>
            </div>
            {testResult && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                background: testResult.ok ? 'var(--green-bg)' : 'var(--red-bg)',
                color: testResult.ok ? 'var(--green)' : 'var(--red)',
                display: 'flex', alignItems: 'center', gap: 8 }}>
                {testResult.ok
                  ? <><Check style={{ width: 14, height: 14 }} /> Testmail erfolgreich gesendet an {testEmail}</>
                  : <><AlertCircle style={{ width: 14, height: 14 }} /> Fehler: {testResult.error}</>}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong>Hinweis:</strong> Speichere zuerst die Konfiguration, dann teste die Verbindung.
              Bei Gmail: Du benötigst ein <em>App-Passwort</em> (nicht dein normales Google-Passwort).
              Gehe dazu zu <strong>myaccount.google.com → Sicherheit → 2-Schritt-Verifizierung → App-Passwörter</strong>.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
