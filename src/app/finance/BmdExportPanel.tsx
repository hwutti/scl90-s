'use client'
import { useState, useEffect } from 'react'
import { Download, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

const EXPENSE_CATS: Record<string, string> = {
  MISC_BUSINESS: 'Sonstiger betr. Aufwand', GENERAL: 'Allg. Ausgabe',
  SESSION_TRANS: 'Sitzungstransaktion', CANCELLATION: 'Storno',
  CONTINUING_ED: 'Fortbildung', THERAPY_TRAINING: 'Lehrtherapie',
  TRAVEL: 'Reisekosten', OFFICE: 'Büroartikel', MARKETING: 'Werbung',
  LITERATURE: 'Literatur', FEES_TAXES: 'Gebühren und Abgaben',
  SVA: 'SVA', RENT: 'Miete', INSURANCE: 'Versicherung', CAR: 'Aufwand PKW',
  OPERATIONS: 'Betriebskosten', ELECTRICITY: 'Strom', PHONE_INTERNET: 'Telefon/Internet',
  CLEANING: 'Reinigung/Verbrauchsmaterial', PERSONNEL: 'Personal',
  SUPERVISION: 'Supervision', DAILY_ALLOWANCE: 'Taggeld',
  ACCOMMODATION: 'Nächtigungsgeld', MILEAGE: 'Kilometergeld', DECOR: 'Deko',
}

interface BmdSettings {
  erlosUstBefreit: string
  erlosUstPflichtig: string
  ustSatz: number
  expenseAccounts: Record<string, string>
}

export function BmdExportPanel({ year }: { year: number }) {
  const [settings, setSettings] = useState<BmdSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)

  useEffect(() => {
    fetch('/api/finance/bmd-settings').then(r => r.json()).then(d => { setSettings(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function updateField(field: keyof BmdSettings, value: any) {
    setSettings(s => s ? { ...s, [field]: value } : s)
    setSaved(false)
  }

  function updateAccount(cat: string, value: string) {
    setSettings(s => s ? { ...s, expenseAccounts: { ...s.expenseAccounts, [cat]: value } } : s)
    setSaved(false)
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    await fetch('/api/finance/bmd-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading || !settings) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Lädt…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: '10px 14px', background: 'var(--amber-bg)',
        border: '0.5px solid var(--amber-border,#fcd34d)', borderRadius: 8,
        fontSize: 12, color: 'var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
        <span>
          Das exakte BMD-NTCS-Importformat ist nicht öffentlich dokumentiert und variiert je nach
          Steuerberatungskanzlei. Diese Datei folgt den allgemeinen BMD-Konventionen (Semikolon-getrennt,
          UTF-8). <strong>Bitte vor der ersten Übermittlung Kontonummern und Format mit Ihrem Steuerberater abstimmen.</strong>
        </span>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Export {year}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Enthält alle Einnahmen und Ausgaben des Jahres als eine gemeinsame Buchungsliste
          (Datum, Belegnummer, Konto, Text, Netto, USt-Satz, USt-Betrag, Brutto). Aus Gründen der
          therapeutischen Verschwiegenheit werden keine Patientennamen exportiert, nur Belegnummern.
        </p>
        <button onClick={() => window.open(`/api/finance/bmd-export?year=${year}`, '_blank')}
          className="btn-primary" style={{ fontSize: 13 }}>
          <Download style={{ width: 14, height: 14 }} /> BMD-Export herunterladen (CSV)
        </button>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Kontozuordnung
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Erlöskonto USt-befreit
            </label>
            <input value={settings.erlosUstBefreit} onChange={e => updateField('erlosUstBefreit', e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Erlöskonto USt-pflichtig
            </label>
            <input value={settings.erlosUstPflichtig} onChange={e => updateField('erlosUstPflichtig', e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              USt-Satz (%)
            </label>
            <input type="number" value={settings.ustSatz} onChange={e => updateField('ustSatz', Number(e.target.value))}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 7, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <button onClick={() => setShowAccounts(s => !s)} className="btn-ghost"
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginBottom: showAccounts ? 10 : 0 }}>
          Aufwandskonten je Kategorie {showAccounts ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
        </button>

        {showAccounts && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
            {Object.entries(EXPENSE_CATS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                <input value={settings.expenseAccounts[key] ?? ''} onChange={e => updateAccount(key, e.target.value)}
                  style={{ width: 70, padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--surface-page)', color: 'var(--text-primary)' }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            <Save style={{ width: 13, height: 13 }} /> {saving ? 'Speichert…' : 'Speichern'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Gespeichert</span>}
        </div>
      </div>
    </div>
  )
}
