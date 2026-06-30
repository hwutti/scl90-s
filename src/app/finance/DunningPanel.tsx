'use client'
import { useState, useEffect, useCallback } from 'react'
import { Mail, Download, Send, Save, ChevronDown, ChevronUp, AlertTriangle, Clock, History } from 'lucide-react'

interface Suggestion {
  transactionId: string
  referenceNumber: string
  patientId: string | null
  patientName: string
  patientEmail: string | null
  amountGross: number
  transactionDate: string
  dueDate: string
  daysOverdue: number
  lastLevel: string | null
  lastSentAt: string | null
  nextLevel: string | null
  readyForAction: boolean
  daysUntilNext: number | null
  maxLevelReached: boolean
  history: { level: string; sentAt: string }[]
}

interface DunningSettings { erinnerungDays: number; mahnung1Days: number; mahnung2Days: number }

const LEVEL_LABELS: Record<string, string> = { ERINNERUNG: 'Zahlungserinnerung', MAHNUNG_1: '1. Mahnung', MAHNUNG_2: '2. Mahnung' }
const fmtEUR = (n: number) => n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtDate = (s: string) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(s))

export function DunningPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const [settings, setSettings] = useState<DunningSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/finance/dunning/suggestions').then(r => r.json()).then(d => { setSuggestions(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    fetch('/api/finance/dunning/settings').then(r => r.json()).then(setSettings).catch(() => {})
  }, [load])

  async function send(s: Suggestion, level: string, viaEmail: boolean) {
    setSendingId(s.transactionId)
    setFeedback(f => ({ ...f, [s.transactionId]: '' }))
    try {
      const res = await fetch('/api/finance/dunning/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: s.transactionId, level, sendEmail: viaEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback(f => ({ ...f, [s.transactionId]: data.error ?? 'Fehler beim Senden' }))
      } else {
        if (!data.emailed) window.open(`/api/finance/dunning/${data.dunningId}/pdf`, '_blank')
        setFeedback(f => ({ ...f, [s.transactionId]: data.emailed ? 'Per E-Mail versendet ✓' : 'PDF erstellt und heruntergeladen ✓' }))
        load()
      }
    } finally {
      setSendingId(null)
    }
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    await fetch('/api/finance/dunning/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
    })
    setSavingSettings(false); setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  if (loading || !suggestions) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Lädt…</div>

  const actionable = suggestions.filter(s => s.readyForAction)
  const waiting = suggestions.filter(s => !s.readyForAction && !s.maxLevelReached)
  const maxed = suggestions.filter(s => s.maxLevelReached)

  function Row({ s }: { s: Suggestion }) {
    const isOpen = expandedId === s.transactionId
    return (
      <div className="card" style={{ padding: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 14 }}>{s.patientName}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {s.referenceNumber}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fmtEUR(s.amountGross)} · fällig seit {fmtDate(s.dueDate)} ({s.daysOverdue} Tage überfällig)
              {s.lastLevel && ` · zuletzt: ${LEVEL_LABELS[s.lastLevel]} am ${fmtDate(s.lastSentAt!)}`}
            </div>
            {!s.patientEmail && (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle style={{ width: 11, height: 11 }} /> Keine E-Mail hinterlegt – nur PDF-Download möglich
              </div>
            )}
            {feedback[s.transactionId] && (
              <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>{feedback[s.transactionId]}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {s.readyForAction && s.nextLevel && (
              <div style={{ display: 'flex', gap: 6 }}>
                {s.patientEmail && (
                  <button onClick={() => send(s, s.nextLevel!, true)} disabled={sendingId === s.transactionId}
                    className="btn-primary" style={{ fontSize: 12 }}>
                    <Mail style={{ width: 13, height: 13 }} /> {LEVEL_LABELS[s.nextLevel]} per E-Mail
                  </button>
                )}
                <button onClick={() => send(s, s.nextLevel!, false)} disabled={sendingId === s.transactionId}
                  className="btn-secondary" style={{ fontSize: 12 }}>
                  <Download style={{ width: 13, height: 13 }} /> Nur PDF
                </button>
              </div>
            )}
            {!s.readyForAction && !s.maxLevelReached && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock style={{ width: 11, height: 11 }} /> {LEVEL_LABELS[s.nextLevel!]} in {s.daysUntilNext} Tag(en)
              </span>
            )}
            {s.maxLevelReached && (
              <button onClick={() => send(s, 'MAHNUNG_2', s.patientEmail ? true : false)} disabled={sendingId === s.transactionId}
                className="btn-secondary" style={{ fontSize: 11 }}>
                2. Mahnung erneut senden
              </button>
            )}
            {s.history.length > 0 && (
              <button onClick={() => setExpandedId(isOpen ? null : s.transactionId)}
                className="btn-ghost" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                <History style={{ width: 11, height: 11 }} /> Verlauf {isOpen ? <ChevronUp style={{ width: 11, height: 11 }} /> : <ChevronDown style={{ width: 11, height: 11 }} />}
              </button>
            )}
          </div>
        </div>
        {isOpen && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
            {s.history.map((h, i) => (
              <div key={i}>{LEVEL_LABELS[h.level]} – {fmtDate(h.sentAt)}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowSettings(s => !s)} className="btn-ghost" style={{ fontSize: 12 }}>
          Fristen einstellen {showSettings ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
        </button>
      </div>

      {showSettings && settings && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tage bis Erinnerung (nach Fälligkeit)</label>
              <input type="number" value={settings.erinnerungDays} onChange={e => setSettings({ ...settings, erinnerungDays: Number(e.target.value) })}
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tage bis 1. Mahnung (nach Erinnerung)</label>
              <input type="number" value={settings.mahnung1Days} onChange={e => setSettings({ ...settings, mahnung1Days: Number(e.target.value) })}
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tage bis 2. Mahnung (nach 1. Mahnung)</label>
              <input type="number" value={settings.mahnung2Days} onChange={e => setSettings({ ...settings, mahnung2Days: Number(e.target.value) })}
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Keine Mahngebühren – es werden ausschließlich die offenen Rechnungsbeträge ausgewiesen.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={saveSettings} disabled={savingSettings} className="btn-primary" style={{ fontSize: 13 }}>
              <Save style={{ width: 13, height: 13 }} /> {savingSettings ? 'Speichert…' : 'Speichern'}
            </button>
            {settingsSaved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Gespeichert</span>}
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Keine überfälligen offenen Honorarnoten 🎉
        </div>
      )}

      {actionable.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Vorschläge zum Versenden ({actionable.length})
          </h3>
          {actionable.map(s => <Row s={s} key={s.transactionId} />)}
        </div>
      )}

      {waiting.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            Überfällig, Frist für nächste Stufe noch nicht erreicht ({waiting.length})
          </h3>
          {waiting.map(s => <Row s={s} key={s.transactionId} />)}
        </div>
      )}

      {maxed.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            Höchste Mahnstufe bereits erreicht ({maxed.length})
          </h3>
          {maxed.map(s => <Row s={s} key={s.transactionId} />)}
        </div>
      )}
    </div>
  )
}
