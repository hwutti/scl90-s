'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Save, Check, AlertCircle, Users, User, Shield, Building2 } from 'lucide-react'

const PERM_LABELS = [
  { key: 'seeCalendar',        label: 'Kalender anderer Therapeuten sehen',          desc: 'Admin kann alle Kalender einsehen' },
  { key: 'calendarAnonymized', label: 'Kalender anonymisiert (kein Patientenname)',   desc: 'Schützt Patientendaten – nur Termintyp und Uhrzeit sichtbar' },
  { key: 'seePatients',        label: 'Patientenakten anderer Therapeuten sehen',     desc: 'Vollzugriff auf alle Patientenprofile' },
  { key: 'seeProtocols',       label: 'Sitzungsprotokolle anderer Therapeuten sehen', desc: 'Lesezugriff auf alle Protokolle' },
  { key: 'seeDiagnoses',       label: 'Diagnosen anderer Therapeuten sehen',          desc: 'Lesezugriff auf alle Diagnosen' },
  { key: 'seeFinance',         label: 'Finanzen / Rechnungen aller Therapeuten',      desc: 'Zugriff auf alle Transaktionen und Honorarnoten' },
]

export function PraxisModusClient({ initialMode, initialPerms, therapists }: {
  initialMode: string
  initialPerms: any
  therapists: any[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState(initialMode)
  const [perms, setPerms] = useState(initialPerms)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/admin/praxis-modus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceMode: mode, adminPermissions: perms }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler')
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push('/admin/settings')} className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Administration
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Praxis-Modus</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{error}</span>}
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><Check style={{ width: 13, height: 13 }} />Gespeichert</span>}
          <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            <Save style={{ width: 13, height: 13 }} />{saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 28, background: 'var(--surface-page)' }}>
        <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Modus-Auswahl */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
              Praxis-Modus
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                {
                  key: 'single', icon: User,
                  title: 'Einzelpraxis',
                  desc: '1 Therapeut (= Admin). Vollzugriff auf alle Daten. Datenschutz-Konflikt nicht möglich.',
                  badge: 'Empfohlen für Einzelpraxis',
                  badgeColor: 'var(--green)',
                  badgeBg: 'var(--green-bg)',
                },
                {
                  key: 'group', icon: Building2,
                  title: 'Gruppenpraxis',
                  desc: 'Mehrere Therapeuten. Strikte Datentrennung. Admin-Rechte konfigurierbar.',
                  badge: 'DSGVO + §14 PTG konform',
                  badgeColor: 'var(--color-primary)',
                  badgeBg: 'var(--color-primary-light)',
                },
              ].map(opt => {
                const Icon = opt.icon
                const active = mode === opt.key
                return (
                  <button key={opt.key} onClick={() => setMode(opt.key)} style={{
                    padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: active ? 'var(--color-primary-light)' : 'var(--surface-card)',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon style={{ width: 18, height: 18, color: active ? 'var(--color-primary)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--text-primary)' }}>{opt.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: opt.badgeColor, background: opt.badgeBg, alignSelf: 'flex-start' }}>
                      {opt.badge}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Admin-Berechtigungen (nur Gruppenpraxis) */}
          {mode === 'group' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                Admin-Berechtigungen in der Gruppenpraxis
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 8 }}>
                ⚠️ Diese Einstellungen haben direkte Auswirkung auf den Datenschutz. Gem. §14 Psychotherapiegesetz (AT) dürfen Therapeuten keine Patientendaten von Kollegen einsehen ohne Einwilligung.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {PERM_LABELS.map(p => (
                  <label key={p.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px', cursor: 'pointer',
                    borderBottom: '0.5px solid var(--border)',
                    background: perms[p.key] ? 'var(--color-primary-light)' : 'var(--surface-card)',
                    borderLeft: `3px solid ${perms[p.key] ? 'var(--color-primary)' : 'transparent'}`,
                  }}>
                    <input type="checkbox" checked={!!perms[p.key]}
                      onChange={e => setPerms((prev: any) => ({ ...prev, [p.key]: e.target.checked }))}
                      style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface-card)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong>Empfehlung:</strong> Für DSGVO-Konformität: Kalender aktivieren aber anonymisiert. Patientenakten, Protokolle und Diagnosen deaktivieren. Finanzen nur wenn Praxisleitung Gesamtüberblick benötigt.
              </div>
            </div>
          )}

          {/* Therapeuten-Übersicht */}
          {therapists.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                Therapeuten im System ({therapists.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {therapists.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>
                      {(t.name ?? t.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span><strong style={{ color: 'var(--text-primary)' }}>{t._count?.therapistPatients ?? 0}</strong> Patienten</span>
                      <span><strong style={{ color: 'var(--text-primary)' }}>{t._count?.therapySessions ?? 0}</strong> Sitzungen</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {therapists.length === 0 && mode === 'group' && (
            <div style={{ padding: '20px 24px', background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              <Users style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 8px' }} />
              <div>Noch keine Therapeuten angelegt.</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => router.push('/admin/users')} className="btn-secondary" style={{ fontSize: 12 }}>
                  Therapeuten verwalten →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
