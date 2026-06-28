'use client'
import { useState } from 'react'
import { Download, Upload, Shield, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react'

export default function BackupsPage() {
  const [creating, setCreating]   = useState(false)
  const [result, setResult]       = useState<any>(null)
  const [error, setError]         = useState<string|null>(null)

  // Importieren
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string|null>(null)

  async function createBackup() {
    if (!confirm('Backup jetzt erstellen? Der Vorgang kann einige Sekunden dauern.')) return
    setCreating(true); setResult(null); setError(null)
    try {
      const res = await fetch('/api/backups', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Backup fehlgeschlagen')
      setResult(data)
    } catch (e: any) {
      setError(e.message ?? 'Unbekannter Fehler')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="topbar">
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Backups</h1>
      </div>

      <div style={{ padding: 20, flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignContent: 'start' }}>

        {/* ── Backup erstellen ── */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Shield style={{ width: 16, height: 16, stroke: 'var(--color-primary)' }} />
            Backup erstellen
          </h2>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Erstellt einen vollständigen Datenbank-Dump (pg_dump) und speichert ihn
            auf dem Server unter <code style={{ fontSize: 11 }}>/var/backups/kds/</code>.
          </p>

          <div style={{ padding: '10px 12px', background: 'var(--color-primary-light)', borderRadius: 8, fontSize: 12, color: 'var(--color-primary)', marginBottom: 16 }}>
            <strong>Information:</strong> Das Backup kann mehrere MB groß sein, wenn viele
            Audiodateien und Dokumente gespeichert wurden. Sichern Sie das Backup
            regelmäßig auch auf einem externen Speicher.
          </div>

          <button onClick={createBackup} disabled={creating} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {creating ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> Backup wird erstellt...</>
            ) : (
              <><Download style={{ width: 14, height: 14 }} /> Backup erstellen</>
            )}
          </button>

          {result && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--green-bg)', border: '0.5px solid var(--green-border,#bbf7d0)', borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                <CheckCircle style={{ width: 14, height: 14 }} /> Backup erfolgreich erstellt
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div>Datei: <code style={{ fontSize: 11 }}>{result.filename}</code></div>
                <div>Pfad: <code style={{ fontSize: 11 }}>{result.path}</code></div>
                <div>Erstellt: {new Date(result.createdAt).toLocaleString('de-AT')}</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--red-bg,#fef2f2)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
              <AlertTriangle style={{ width: 13, height: 13, display: 'inline', marginRight: 6 }} />
              {error}
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Stellen Sie sicher, dass <code>pg_dump</code> auf dem Server installiert ist
                und <code>DATABASE_URL</code> korrekt gesetzt ist.
              </p>
            </div>
          )}
        </div>

        {/* ── Backup importieren ── */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Upload style={{ width: 16, height: 16, stroke: 'var(--color-primary)' }} />
            Backup importieren
          </h2>

          <div style={{ padding: '10px 12px', background: 'var(--amber-bg)', border: '0.5px solid var(--amber-border,#fcd34d)', borderRadius: 8, fontSize: 12, color: 'var(--amber)', marginBottom: 16 }}>
            <AlertTriangle style={{ width: 12, height: 12, display: 'inline', marginRight: 6 }} />
            <strong>Vor dem Import</strong> wird empfohlen, ein aktuelles Sicherheitsbackup zu erstellen.
            Der Import überschreibt bestehende Daten.
          </div>

          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
              Eigenes Backup
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
              Wähle eine zuvor erstellte <code>.sql</code>-Backup-Datei aus.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              ⚠️ Der Import über die Web-Oberfläche ist aus Sicherheitsgründen deaktiviert.
              Bitte führe den Import direkt auf dem Server aus:
            </p>
            <pre style={{ fontSize: 11, background: 'var(--surface-panel)', padding: '10px 12px', borderRadius: 8, overflow: 'auto', color: 'var(--text-primary)', margin: 0 }}>
{`# Auf dem Server ausführen:
sudo -u kds psql "$DATABASE_URL" < /var/backups/kds/kds-backup-DATUM.sql`}
            </pre>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
              Automatisch generiertes Backup
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
              Backups werden automatisch täglich unter <code style={{ fontSize: 11 }}>/var/backups/kds/</code> gespeichert.
              Wähle ein Datum:
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" className="input" style={{ flex: 1 }} defaultValue={new Date().toISOString().slice(0,10)} />
              <button className="btn-secondary" style={{ fontSize: 12, opacity: 0.6, cursor: 'not-allowed' }} disabled>
                Backup importieren
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Web-Import aus Sicherheitsgründen deaktiviert. Bitte Server-CLI verwenden.
            </p>
          </div>
        </div>

        {/* ── Backup-Log ── */}
        <div className="card" style={{ padding: 16, gridColumn: '1/-1' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Clock style={{ width: 14, height: 14, stroke: 'var(--text-muted)' }} />
            Backup-Hinweis
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <li>Backups werden als <code>.sql</code>-Dump auf dem Server gespeichert.</li>
            <li>Für regelmäßige automatische Backups: <code>sudo /opt/kds/update.sh</code> einrichten oder Cron-Job verwenden.</li>
            <li>Der Server-Backup-Pfad lautet standardmäßig <code>/var/backups/kds/</code>.</li>
            <li>Vor Updates wird automatisch ein Backup empfohlen.</li>
            <li>Alle Backup- und Restore-Vorgänge werden im AuditLog festgehalten.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
