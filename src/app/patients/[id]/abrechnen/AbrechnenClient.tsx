'use client'
import { useState, useEffect, useRef, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, ChevronRight, Calendar, Clock,
  Check, AlertCircle, FileText, Loader, Printer, Mail, X,
} from 'lucide-react'

const RichTextEditor = dynamic(
  () => import('@/components/editor/RichTextEditor').then(m => m.RichTextEditor),
  { ssr: false, loading: () => <div style={{ height: 24, background: 'transparent' }} /> }
)

function fmtEUR(n: any) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n ?? 0))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMins(m: number | null) {
  if (!m) return '—'
  return m >= 60 ? `${Math.floor(m/60)}h ${m%60 > 0 ? m%60+'min' : ''}`.trim() : `${m} min`
}
// Next.js/React Server Components geben Date-Felder als echte Date-Objekte an
// Client-Komponenten weiter (nicht als String) — daher hier immer normalisieren,
// bevor irgendwo .slice() o.ä. auf einem Datum aufgerufen wird.
function toDateInputValue(d: any): string | null {
  if (!d) return null
  if (typeof d === 'string') return d
  if (d instanceof Date) return d.toISOString()
  return String(d)
}

const PAYMENT_LABELS: Record<string, string> = {
  UNBAR_BANK_TRANSFER: 'Überweisung',
  CASH: 'Bar',
  CARD_BANKOMAT: 'Karte / Bankomat',
}

// ── Editierbare Position (Sitzungs-Grundpreis ODER Zusatzleistung) ────────────
interface LineEdit {
  description?: string
  descriptionHtml?: string
  quantity?: number
  unitPriceNet?: number
  lineDate?: string | null
  // Kleine graue Unterzeile unter der Beschreibung im fertigen Dokument
  // (z.B. "Psychotherapeutische Behandlung 45") -- leerer String blendet sie aus.
  serviceLabel?: string
}
interface ResolvedLine {
  key: string
  sessionId: string
  sessionLabel: string
  isFirstOfSession: boolean
  description: string
  descriptionHtml?: string
  quantity: number
  unitPriceNet: number
  lineDate: string | null
  serviceLabel: string
}

interface Branding {
  praxisName: string
  address: string | null
  contactEmail: string | null
  contactPhone: string | null
  logoBase64: string | null
  logoMimeType: string | null
  colorPrimary: string
}

export function AbrechnenClient({
  patient, sessions: initialSessions, allUnbilled,
  invoiceTemplates, therapistName, role, branding,
  initialDraft, existingDrafts,
}: {
  patient: any
  sessions: any[]
  allUnbilled: any[]
  invoiceTemplates: any[]
  therapistName: string
  role: string
  branding: Branding
  initialDraft?: any
  existingDrafts?: { id: string; updatedAt: string }[]
}) {
  const router = useRouter()

  // Aktuell geladener Entwurf (falls über "Weiterbearbeiten" geöffnet oder
  // bereits einmal während dieser Sitzung gespeichert)
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [dismissedDraftBanner, setDismissedDraftBanner] = useState(false)

  // Ausgewählte Sessions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialDraft?.sessionIds?.length ? initialDraft.sessionIds : initialSessions.map((s: any) => s.id))
  )
  const selected = allUnbilled.filter(s => selectedIds.has(s.id))

  function removeSession(sessionId: string) {
    const next = new Set(selectedIds); next.delete(sessionId); setSelectedIds(next)
  }

  // Einzelne Positionen können unabhängig von der Sitzung gelöscht werden (z.B.
  // wenn die Sitzung selbst korrekt im System verbucht bleiben soll, aber die
  // automatisch befüllte Position umgeschrieben oder ganz entfernt werden soll).
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(
    new Set(initialDraft?.removedLineKeys ?? [])
  )
  function removeLineOnly(key: string, sessionId: string) {
    const next = new Set(removedKeys); next.add(key); setRemovedKeys(next)
    // Wenn dadurch ALLE Positionen dieser Sitzung entfernt wären, macht es keinen
    // Sinn, die Sitzung weiter als "ausgewählt" zu führen -- dann auch abwählen.
    const session = allUnbilled.find(s => s.id === sessionId)
    if (session) {
      const stillRemaining = resolveLinesForSession(session).some(l => l.key !== key && !next.has(l.key))
      if (!stillRemaining) removeSession(sessionId)
    }
  }

  // Manuelle Überschreibungen einzelner Positionen (Beschreibung/Menge/Preis/Datum)
  // Key: "session:<id>" für die Sitzungs-Grundposition, "service:<id>" für Zusatzleistungen
  const [lineEdits, setLineEdits] = useState<Record<string, LineEdit>>(initialDraft?.lineItemOverrides ?? {})
  function updateLineEdit(key: string, patch: LineEdit) {
    setLineEdits(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  // Freitext, der unter den Positionen auf der Honorarnote erscheint
  const [customNoteHtml, setCustomNoteHtml] = useState(initialDraft?.customNoteHtml ?? '')

  // Aus Session-Daten + Overrides die tatsächlichen Rechnungspositionen ableiten
  function resolveLinesForSession(s: any): ResolvedLine[] {
    const lines: ResolvedLine[] = []
    const baseKey = `session:${s.id}`
    const baseEdit = lineEdits[baseKey] ?? {}
    lines.push({
      key: baseKey,
      sessionId: s.id,
      sessionLabel: `${s.name} · ${fmtDate(s.sessionDate)}`,
      isFirstOfSession: true,
      description: baseEdit.description ?? `Sitzung-${s.sessionNumber}`,
      descriptionHtml: baseEdit.descriptionHtml,
      quantity: baseEdit.quantity ?? 1,
      unitPriceNet: baseEdit.unitPriceNet ?? parseFloat(s.calculatedPriceNet ?? 0),
      lineDate: baseEdit.lineDate ?? toDateInputValue(s.sessionDate),
      serviceLabel: baseEdit.serviceLabel ?? s.serviceLabel ?? '',
    })
    for (const l of s.serviceLines ?? []) {
      const key = `service:${l.id}`
      const edit = lineEdits[key] ?? {}
      lines.push({
        key,
        sessionId: s.id,
        sessionLabel: `${s.name} · ${fmtDate(s.sessionDate)}`,
        isFirstOfSession: false,
        description: edit.description ?? l.description,
        descriptionHtml: edit.descriptionHtml,
        quantity: edit.quantity ?? parseFloat(l.quantity),
        unitPriceNet: edit.unitPriceNet ?? parseFloat(l.unitPriceNet),
        lineDate: edit.lineDate ?? toDateInputValue(s.sessionDate),
        serviceLabel: edit.serviceLabel ?? l.catalogCode ?? '',
      })
    }
    return lines
  }

  const allResolvedLines = selected.flatMap(s => resolveLinesForSession(s).filter(l => !removedKeys.has(l.key)))

  // Frei hinzugefügte Positionen ohne Sitzungsbezug (z.B. Sonderleistungen) —
  // direkt per "+ Position hinzufügen" in der Tabelle editierbar, wie eine neue
  // Excel-Zeile.
  interface ManualLine {
    id: string
    description: string
    descriptionHtml: string
    quantity: number
    unitPriceNet: number
    lineDate: string
  }
  const [manualLines, setManualLines] = useState<ManualLine[]>(initialDraft?.manualLines ?? [])
  function addManualLine() {
    const today = new Date().toISOString().slice(0, 10)
    setManualLines(prev => [...prev, {
      id: `manual-${Date.now()}-${prev.length}`,
      description: '', descriptionHtml: '', quantity: 1, unitPriceNet: 0, lineDate: today,
    }])
  }
  function updateManualLine(id: string, patch: Partial<ManualLine>) {
    setManualLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }
  function removeManualLine(id: string) {
    setManualLines(prev => prev.filter(l => l.id !== id))
  }

  // Verrechnung: Summe wird IMMER direkt aus Menge × Einzelpreis der tatsächlichen
  // Positions-Daten berechnet — nie aus Freitext o.ä. — damit sie zwingend korrekt bleibt.
  const totalNet = allResolvedLines.reduce((sum, l) => sum + l.quantity * l.unitPriceNet, 0)
    + manualLines.reduce((sum, l) => sum + l.quantity * l.unitPriceNet, 0)

  // Formular — vorausgefüllt aus Patientenprofil
  const payerNameDefault = patient.billRecipientName
    || `${patient.firstName} ${patient.lastName}`
  const payerAddressDefault = [patient.billRecipientAddress, patient.billRecipientCity]
    .filter(Boolean).join(', ')

  const [form, setForm] = useState({
    payerName:           initialDraft?.payerName ?? payerNameDefault,
    payerAddress:        initialDraft?.payerAddress ?? payerAddressDefault,
    vatRate:             initialDraft?.vatRate ?? parseFloat(patient.defaultVatRate ?? 0),
    paymentMethod:       initialDraft?.paymentMethod ?? patient.defaultPaymentMethod ?? 'UNBAR_BANK_TRANSFER',
    markAsPaid:          initialDraft ? Boolean(initialDraft.markAsPaid) : Boolean(patient.defaultMarkAsPaid),
    generateInvoiceDoc:  initialDraft ? initialDraft.generateInvoiceDoc !== false : true,
    anonymizeInvoice:    initialDraft ? Boolean(initialDraft.anonymizeInvoice) : false,
    invoiceTemplateId:   initialDraft?.invoiceTemplateId ?? patient.defaultInvoiceTemplateId ?? '',
    notes:               initialDraft?.notes ?? '',
  })

  const vatAmount  = totalNet * form.vatRate
  const totalGross = totalNet + vatAmount

  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')

  // Separate Vorschau des tatsächlich fertigen Dokuments (inkl. Fußzeile, Signatur,
  // SEPA-QR-Code, Vorlage etc. — Dinge, die der Direkt-Editor bewusst nicht zeigt)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (previewDebounce.current) clearTimeout(previewDebounce.current)
    if (selectedIds.size === 0) { setPreviewHtml(''); return }
    setPreviewLoading(true)
    previewDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients/${patient.id}/abrechnen/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayloadBase()),
        })
        const data = await res.json()
        if (res.ok) setPreviewHtml(data.html)
      } catch { /* Vorschau ist optional -- Fehler hier nicht blockierend anzeigen */ }
      setPreviewLoading(false)
    }, 500)
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, lineEdits, manualLines, removedKeys, customNoteHtml, form.payerName, form.payerAddress, form.vatRate, form.notes, form.invoiceTemplateId])

  const [done,   setDone]     = useState<{ referenceNumber: string; transactionId?: string; invoiceHtml?: string } | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailTo, setEmailTo]   = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [sending,  setSending]  = useState(false)
  const [emailDone, setEmailDone] = useState(false)
  const [emailErr,  setEmailErr]  = useState('')

  const backUrl = `/patients/${patient.id}?tab=sitzungen`

  // Gemeinsamer Zustand für Vorschau/Erstellen/Entwurf-Speichern, damit alle drei
  // garantiert dieselben Daten verwenden (keine Abweichungen möglich).
  function buildPayloadBase() {
    const lineItemOverrides: Record<string, LineEdit> = {}
    for (const l of allResolvedLines) {
      if (lineEdits[l.key]) lineItemOverrides[l.key] = lineEdits[l.key]
    }
    return {
      sessionIds: [...selectedIds],
      payerName: form.payerName,
      payerAddress: form.payerAddress,
      vatRate: form.vatRate,
      markAsPaid: form.markAsPaid,
      paymentMethod: form.paymentMethod,
      generateInvoiceDoc: form.generateInvoiceDoc,
      anonymizeInvoice: form.anonymizeInvoice,
      invoiceTemplateId: form.invoiceTemplateId || null,
      notes: form.notes,
      lineItemOverrides,
      manualLines: manualLines.map(l => ({
        description: l.description, descriptionHtml: l.descriptionHtml,
        quantity: l.quantity, unitPriceNet: l.unitPriceNet, lineDate: l.lineDate || null,
      })),
      removedLineKeys: [...removedKeys],
      customNoteHtml: customNoteHtml || undefined,
    }
  }

  async function saveDraft() {
    setDraftSaving(true)
    try {
      if (draftId) {
        await fetch(`/api/invoice-drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayloadBase()),
        })
      } else {
        const res = await fetch(`/api/patients/${patient.id}/abrechnen/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayloadBase()),
        })
        const data = await res.json()
        if (res.ok) setDraftId(data.id)
      }
      setDraftSavedAt(new Date())
    } catch { /* nicht kritisch -- Nutzer kann es erneut versuchen */ }
    setDraftSaving(false)
  }

  async function discardDraft(id: string) {
    await fetch(`/api/invoice-drafts/${id}`, { method: 'DELETE' }).catch(() => null)
    setDismissedDraftBanner(true)
  }

  async function submit() {
    if (!form.payerName.trim()) { setError('Rechnungsempfänger fehlt.'); return }
    if (selectedIds.size === 0)  { setError('Keine Sitzungen ausgewählt.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/transactions/from-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPayloadBase(),
          patientId: patient.id,
          payeeName: therapistName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`)
      setDone({ referenceNumber: data.referenceNumber, transactionId: data.id ?? data.transactionId, invoiceHtml: data.invoiceHtml })
      // Entwurf ist jetzt zur echten Rechnung geworden -- aufräumen
      if (draftId) fetch(`/api/invoice-drafts/${draftId}`, { method: 'DELETE' }).catch(() => null)
      // E-Mail-Adresse aus Patientenprofil vorausfüllen
      if ((patient as any).email) setEmailTo((patient as any).email)
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function sendInvoiceEmail() {
    if (!done?.transactionId || !emailTo) return
    setSending(true); setEmailErr('')
    try {
      const res = await fetch('/api/transactions/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: done.transactionId, toEmail: emailTo, message: emailMsg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setEmailDone(true)
      setShowEmailForm(false)
    } catch (e: any) { setEmailErr(e.message) }
    setSending(false)
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '0.5px solid var(--border)', borderRadius: 7,
    background: 'var(--surface-page)', color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: 11, fontWeight: 500 as const, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
  const sectionStyle = { fontSize: 12, fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }

  // Borderloses "Zellen"-Eingabefeld, das erst bei Fokus/Hover als Feld erkennbar
  // wird — für das Word/Excel-artige Gefühl direkt im Rechnungs-Papier.
  const cellInputBase: CSSProperties = {
    border: '1px solid transparent', borderRadius: 5, background: 'transparent',
    font: 'inherit', color: 'inherit', padding: '3px 5px', boxSizing: 'border-box',
    outline: 'none',
  }
  const cellFocusHandlers = {
    onFocus: (e: FocusEvent<HTMLInputElement>) => { e.target.style.border = '1px solid var(--color-primary)'; e.target.style.background = '#fff' },
    onBlur:  (e: FocusEvent<HTMLInputElement>) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' },
    onMouseEnter: (e: MouseEvent<HTMLInputElement>) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = '1px solid #d8dce3' },
    onMouseLeave: (e: MouseEvent<HTMLInputElement>) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = '1px solid transparent' },
  }

  // ── Erfolgsseite ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => router.push(backUrl)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück zur Akte
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 720 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check style={{ width: 32, height: 32, color: 'var(--green)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Honorarnote erstellt</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {done.referenceNumber} · {selected.length} Sitzung{selected.length !== 1 ? 'en' : ''} · {fmtEUR(totalGross)}
            </div>
            {form.markAsPaid && <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 4 }}>✓ Als bezahlt markiert ({PAYMENT_LABELS[form.paymentMethod]})</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => router.push(backUrl)} className="btn-secondary" style={{ fontSize: 13 }}>
              Zurück zur Akte
            </button>
            {done?.transactionId && (
              <button
                onClick={() => window.open(`/api/transactions/${done.transactionId}/invoice`, '_blank')}
                className="btn-secondary" style={{ fontSize: 13 }}>
                <Printer style={{ width: 13, height: 13 }} /> Drucken / PDF
              </button>
            )}
            <button onClick={() => setShowEmailForm(s => !s)} className="btn-primary" style={{ fontSize: 13 }}>
              <Mail style={{ width: 13, height: 13 }} /> Per E-Mail senden
            </button>
            <button onClick={() => router.push(`/finance`)} className="btn-secondary" style={{ fontSize: 13 }}>
              Zu Finanzen
            </button>
          </div>

          {/* Vorschau des tatsächlich erstellten Dokuments */}
          {done.invoiceHtml && (
            <div style={{ width: '100%', marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'left' }}>Honorarnote</div>
              <iframe
                srcDoc={done.invoiceHtml}
                title="Honorarnote"
                style={{ width: '100%', height: 480, border: '0.5px solid var(--border)', borderRadius: 10, background: '#fff' }}
              />
            </div>
          )}

          {/* E-Mail Formular */}
          {showEmailForm && (
            <div style={{ width: '100%', maxWidth: 440, marginTop: 16, padding: 16, background: 'var(--surface-card)', borderRadius: 12, border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Honorarnote per E-Mail senden</span>
                <button onClick={() => setShowEmailForm(false)} className="btn-ghost" style={{ padding: 4 }}><X style={{ width: 14, height: 14 }} /></button>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Empfänger *</label>
                <input type="email"
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--surface-page)', color: 'var(--text-primary)', boxSizing: 'border-box' as const }}
                  value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="patient@email.at" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Persönliche Nachricht (optional)</label>
                <textarea
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--surface-page)', color: 'var(--text-primary)', boxSizing: 'border-box' as const, resize: 'vertical', minHeight: 70 }}
                  value={emailMsg} onChange={e => setEmailMsg(e.target.value)} placeholder="Optionale Nachricht an den Patienten..." />
              </div>
              {emailErr && <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle style={{ width: 13, height: 13 }} />{emailErr}</div>}
              {emailDone && <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}><Check style={{ width: 13, height: 13 }} />E-Mail erfolgreich gesendet!</div>}
              <button onClick={sendInvoiceEmail} disabled={sending || !emailTo || emailDone} className="btn-primary" style={{ fontSize: 13, justifyContent: 'center' }}>
                {sending ? 'Sende...' : <><Mail style={{ width: 13, height: 13 }} /> Senden</>}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    )
  }

  // ── Hauptseite ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.push(backUrl)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 10px' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Zurück zur Akte
        </button>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{patient.firstName} {patient.lastName}</span>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Honorarnote erstellen</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle style={{ width: 13, height: 13 }} />{error}</span>}
          {draftSavedAt && !draftSaving && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Entwurf gespeichert {draftSavedAt.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <button onClick={saveDraft} disabled={draftSaving || selectedIds.size === 0} className="btn-secondary" style={{ fontSize: 13 }}>
            {draftSaving ? <><Loader style={{ width: 13, height: 13 }} /> Speichere...</> : 'Entwurf speichern'}
          </button>
          <button onClick={submit} disabled={saving || selectedIds.size === 0} className="btn-primary" style={{ fontSize: 13, minWidth: 160 }}>
            {saving
              ? <><Loader style={{ width: 13, height: 13 }} /> Erstelle...</>
              : <><FileText style={{ width: 13, height: 13 }} /> Honorarnote erstellen</>}
          </button>
        </div>
      </div>

      {/* Hinweis auf vorhandene Entwürfe zum Weiterbearbeiten */}
      {!draftId && !dismissedDraftBanner && existingDrafts && existingDrafts.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', background: 'var(--color-primary-light)', borderBottom: '0.5px solid var(--border)', fontSize: 12.5, flexShrink: 0 }}>
          <span style={{ color: 'var(--color-primary)' }}>
            Du hast {existingDrafts.length === 1 ? 'einen gespeicherten Entwurf' : `${existingDrafts.length} gespeicherte Entwürfe`} für diesen Patienten.
          </span>
          <button onClick={() => router.push(`/patients/${patient.id}/abrechnen?draftId=${existingDrafts[0].id}`)}
            className="btn-ghost" style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'underline', padding: '2px 6px' }}>
            Neuesten weiterbearbeiten
          </button>
          <button onClick={() => discardDraft(existingDrafts[0].id)}
            className="btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 6px' }}>
            Verwerfen
          </button>
          <button onClick={() => setDismissedDraftBanner(true)}
            className="btn-ghost" style={{ marginLeft: 'auto', padding: 3, color: 'var(--text-muted)' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}

      {/* Body: zwei Spalten */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Linke Spalte: Auswahl + editierbare Honorarnote im Original-Look */}
        <div style={{ overflowY: 'auto', padding: 24, background: 'var(--surface-page)' }}>

          {/* Schritt 1: Sitzungen auswählen (kompakt) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Sitzungen auswählen
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedIds(new Set(allUnbilled.map(s => s.id)))} className="btn-ghost" style={{ fontSize: 12 }}>Alle</button>
              <button onClick={() => setSelectedIds(new Set())} className="btn-ghost" style={{ fontSize: 12 }}>Keine</button>
            </div>
          </div>

          {allUnbilled.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Keine offenen Sitzungen vorhanden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
              {allUnbilled.map(s => {
                const checked = selectedIds.has(s.id)
                return (
                  <label key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: checked ? 'var(--color-primary-light)' : 'var(--surface-card)',
                    transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        const next = new Set(selectedIds)
                        if (e.target.checked) next.add(s.id)
                        else next.delete(s.id)
                        setSelectedIds(next)
                      }}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 2, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar style={{ width: 11, height: 11 }} />{fmtDate(s.sessionDate)}
                        </span>
                        {s.durationMinutes && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock style={{ width: 11, height: 11 }} />{fmtMins(s.durationMinutes)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: checked ? 'var(--color-primary)' : 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>
                      {fmtEUR(parseFloat(s.calculatedPriceNet ?? 0) + parseFloat(s.serviceLinesTotalNet ?? 0))}
                      {parseFloat(s.serviceLinesTotalNet ?? 0) > 0 && (
                        <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>
                          inkl. {fmtEUR(s.serviceLinesTotalNet)} Zusatzleistungen
                        </div>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {/* Schritt 2: Die Honorarnote selbst — direkt darin editieren, wie in Word/Excel */}
          {selected.length > 0 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Honorarnote
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Direkt bearbeitbar — Beschreibung, Menge, Preis und Freitext klicken und ändern. Die Summe unten wird automatisch korrekt berechnet.
              </div>

              {/* "Papier" im echten Rechnungs-Look */}
              <div style={{
                background: '#fff', borderRadius: 12, border: '0.5px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '30px 34px', color: '#1a1a1a',
              }}>
                {/* Header: Logo/Praxis links, Kontakt rechts */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    {branding.logoBase64 && (
                      <img src={`data:${branding.logoMimeType || 'image/png'};base64,${branding.logoBase64}`}
                        alt="Logo" style={{ height: 42, marginBottom: 6, display: 'block' }} />
                    )}
                    <div style={{ fontSize: 17, fontWeight: 700, color: branding.colorPrimary }}>{branding.praxisName}</div>
                    {branding.address && <div style={{ fontSize: 11.5, color: '#666', marginTop: 2 }}>{branding.address}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: '#666' }}>
                    {branding.contactEmail && <div>{branding.contactEmail}</div>}
                    {branding.contactPhone && <div>{branding.contactPhone}</div>}
                  </div>
                </div>
                <div style={{ borderTop: `2px solid ${branding.colorPrimary}`, marginBottom: 20 }} />

                {/* Empfänger + Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22, gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: 0.5, color: '#999', marginBottom: 4 }}>RECHNUNG AN</div>
                    <input value={form.payerName}
                      onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))}
                      style={{ ...cellInputBase, fontSize: 14, fontWeight: 600, width: '100%', marginBottom: 2 }}
                      {...cellFocusHandlers} placeholder="Name des Empfängers" />
                    <input value={form.payerAddress}
                      onChange={e => setForm(f => ({ ...f, payerAddress: e.target.value }))}
                      style={{ ...cellInputBase, fontSize: 12, color: '#555', width: '100%' }}
                      {...cellFocusHandlers} placeholder="Adresse (optional)" />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: '#555', flexShrink: 0, lineHeight: 1.7 }}>
                    <div>Rechnungsnummer&nbsp; <strong>VORSCHAU</strong></div>
                    <div>Rechnungsdatum&nbsp; <strong>{fmtDate(new Date())}</strong></div>
                  </div>
                </div>

                <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 14px', color: '#1a1a1a' }}>Honorarnote</h1>

                {/* Positions-Tabelle — jede Zelle direkt editierbar */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1.5px solid ${branding.colorPrimary}` }}>
                      <th style={{ textAlign: 'left', padding: '0 6px 8px 4px', fontSize: 11, color: '#888', fontWeight: 600, width: 108 }}>Datum</th>
                      <th style={{ textAlign: 'left', padding: '0 6px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>Beschreibung</th>
                      <th style={{ textAlign: 'center', padding: '0 6px 8px', fontSize: 11, color: '#888', fontWeight: 600, width: 54 }}>Anz.</th>
                      <th style={{ textAlign: 'right', padding: '0 6px 8px', fontSize: 11, color: '#888', fontWeight: 600, width: 84 }}>Einzel €</th>
                      <th style={{ textAlign: 'right', padding: '0 4px 8px 6px', fontSize: 11, color: '#888', fontWeight: 600, width: 84 }}>Gesamt €</th>
                      <th style={{ width: 26 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map(s => {
                      const lines = resolveLinesForSession(s).filter(l => !removedKeys.has(l.key))
                      return lines.map(line => (
                        <tr key={line.key} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 6px 6px 4px', verticalAlign: 'top' }}>
                            <input type="date"
                              value={line.lineDate ? line.lineDate.slice(0, 10) : ''}
                              onChange={e => updateLineEdit(line.key, { lineDate: e.target.value || null })}
                              style={{ ...cellInputBase, width: '100%' }} {...cellFocusHandlers} />
                            {line.isFirstOfSession && (
                              <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 2, paddingLeft: 5 }}>{s.name}</div>
                            )}
                          </td>
                          <td style={{ padding: '6px', verticalAlign: 'top' }}>
                            <RichTextEditor
                              value={line.descriptionHtml || line.description}
                              onChange={html => updateLineEdit(line.key, { descriptionHtml: html })}
                              placeholder="Beschreibung…"
                              minHeight={22}
                              compact
                            />
                            <input
                              value={line.serviceLabel}
                              onChange={e => updateLineEdit(line.key, { serviceLabel: e.target.value })}
                              placeholder="Zusatzbezeichnung (optional, erscheint klein darunter)"
                              style={{ ...cellInputBase, width: '100%', fontSize: 10.5, color: '#888', marginTop: 2 }}
                              {...cellFocusHandlers} />
                          </td>
                          <td style={{ padding: '6px', verticalAlign: 'top' }}>
                            <input type="number" step="0.5"
                              value={line.quantity}
                              onChange={e => updateLineEdit(line.key, { quantity: parseFloat(e.target.value) || 0 })}
                              style={{ ...cellInputBase, width: '100%', textAlign: 'center' }} {...cellFocusHandlers} />
                          </td>
                          <td style={{ padding: '6px', verticalAlign: 'top' }}>
                            <input type="number" step="0.01"
                              value={line.unitPriceNet}
                              onChange={e => updateLineEdit(line.key, { unitPriceNet: parseFloat(e.target.value) || 0 })}
                              style={{ ...cellInputBase, width: '100%', textAlign: 'right' }} {...cellFocusHandlers} />
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, verticalAlign: 'top', paddingTop: 12 }}>
                            {fmtEUR(line.quantity * line.unitPriceNet)}
                          </td>
                          <td style={{ verticalAlign: 'top', paddingTop: 8 }}>
                            <button onClick={() => removeLineOnly(line.key, line.sessionId)} className="btn-ghost"
                              style={{ padding: 3, color: 'var(--text-muted)' }} title="Diese Position entfernen">
                              <X style={{ width: 12, height: 12 }} />
                            </button>
                          </td>
                        </tr>
                      ))
                    })}
                    {manualLines.map(line => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 6px 6px 4px', verticalAlign: 'top' }}>
                          <input type="date"
                            value={line.lineDate}
                            onChange={e => updateManualLine(line.id, { lineDate: e.target.value })}
                            style={{ ...cellInputBase, width: '100%' }} {...cellFocusHandlers} />
                          <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 2, paddingLeft: 5 }}>Manuelle Position</div>
                        </td>
                        <td style={{ padding: '6px', verticalAlign: 'top' }}>
                          <RichTextEditor
                            value={line.descriptionHtml || line.description}
                            onChange={html => updateManualLine(line.id, { descriptionHtml: html })}
                            placeholder="Beschreibung…"
                            minHeight={22}
                            compact
                          />
                        </td>
                        <td style={{ padding: '6px', verticalAlign: 'top' }}>
                          <input type="number" step="0.5"
                            value={line.quantity}
                            onChange={e => updateManualLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                            style={{ ...cellInputBase, width: '100%', textAlign: 'center' }} {...cellFocusHandlers} />
                        </td>
                        <td style={{ padding: '6px', verticalAlign: 'top' }}>
                          <input type="number" step="0.01"
                            value={line.unitPriceNet}
                            onChange={e => updateManualLine(line.id, { unitPriceNet: parseFloat(e.target.value) || 0 })}
                            style={{ ...cellInputBase, width: '100%', textAlign: 'right' }} {...cellFocusHandlers} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, verticalAlign: 'top', paddingTop: 12 }}>
                          {fmtEUR(line.quantity * line.unitPriceNet)}
                        </td>
                        <td style={{ verticalAlign: 'top', paddingTop: 8 }}>
                          <button onClick={() => removeManualLine(line.id)} className="btn-ghost"
                            style={{ padding: 3, color: 'var(--text-muted)' }} title="Position entfernen">
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button onClick={addManualLine} className="btn-ghost"
                  style={{ fontSize: 12, marginTop: 8, padding: '5px 8px', color: 'var(--color-primary)' }}>
                  + Position hinzufügen
                </button>

                {/* Summenblock */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <div style={{ width: 230 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                      <span style={{ color: '#666' }}>Nettobetrag</span>
                      <span>{fmtEUR(totalNet)}</span>
                    </div>
                    {form.vatRate > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
                        <span style={{ color: '#666' }}>MwSt. {Math.round(form.vatRate * 100)}%</span>
                        <span>{fmtEUR(vatAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 4, borderTop: '1.5px solid #1a1a1a', fontSize: 15, fontWeight: 700 }}>
                      <span>Gesamtbetrag</span>
                      <span>{fmtEUR(totalGross)}</span>
                    </div>
                  </div>
                </div>

                {/* Freitext — erscheint unter den Positionen auf der echten Honorarnote */}
                <div style={{ marginTop: 22, paddingTop: 14, borderTop: '0.5px solid #eee' }}>
                  <RichTextEditor
                    value={customNoteHtml}
                    onChange={setCustomNoteHtml}
                    placeholder="Optionaler Freitext, der unter den Positionen erscheint (Fettdruck, Listen, Farben…)"
                    minHeight={60}
                  />
                </div>
              </div>

              {/* Separate Vorschau: das tatsächlich fertige Dokument (Fußzeile,
                  Signatur, SEPA-QR-Code, gewählte Vorlage etc. — Dinge, die der
                  Direkt-Editor oben bewusst vereinfacht/weglässt) */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Vorschau (fertiges Dokument)</h2>
                  {previewLoading && <Loader style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />}
                </div>
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    title="Vorschau"
                    style={{ width: '100%', height: 520, border: '0.5px solid var(--border)', borderRadius: 10, background: '#fff' }}
                  />
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--surface-card)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
                    Vorschau wird geladen…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Formular */}
        <div style={{ overflowY: 'auto', padding: 24, background: 'var(--surface-card)', borderLeft: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* MwSt. & Zahlung */}
          <div>
            <div style={sectionStyle}>Abrechnung</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={labelStyle}>MwSt.</label>
                <select style={inputStyle} value={form.vatRate}
                  onChange={e => setForm(f => ({ ...f, vatRate: parseFloat(e.target.value) }))}>
                  <option value={0}>0 % (keine MwSt.)</option>
                  <option value={0.1}>10 %</option>
                  <option value={0.2}>20 %</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zahlungsart</label>
                <select style={inputStyle} value={form.paymentMethod}
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="UNBAR_BANK_TRANSFER">Überweisung</option>
                  <option value="CASH">Bar</option>
                  <option value="CARD_BANKOMAT">Karte / Bankomat</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.markAsPaid}
                  onChange={e => setForm(f => ({ ...f, markAsPaid: e.target.checked }))} />
                Sofort als bezahlt markieren
              </label>
            </div>
          </div>

          {/* Honorarnote */}
          <div>
            <div style={sectionStyle}>Honorarnote-Dokument</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                <input type="checkbox" checked={form.generateInvoiceDoc}
                  onChange={e => setForm(f => ({ ...f, generateInvoiceDoc: e.target.checked }))} />
                PDF-Honorarnote generieren
              </label>
              {form.generateInvoiceDoc && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', background: 'var(--surface-page)', borderRadius: 7 }}>
                    <input type="checkbox" checked={form.anonymizeInvoice}
                      onChange={e => setForm(f => ({ ...f, anonymizeInvoice: e.target.checked }))} />
                    Anonymisieren (Codename statt Klarname)
                  </label>
                  <div>
                    <label style={labelStyle}>Vorlage</label>
                    <select style={inputStyle} value={form.invoiceTemplateId}
                      onChange={e => setForm(f => ({ ...f, invoiceTemplateId: e.target.value }))}>
                      <option value="">Standard (automatisch)</option>
                      {invoiceTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' ★' : ''}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interne Notiz (erscheint NICHT auf der Honorarnote) */}
          <div>
            <div style={sectionStyle}>Interne Notiz (optional)</div>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              value={form.notes} placeholder="Nur intern sichtbar, nicht auf der Honorarnote"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Zusammenfassung */}
          {selected.length > 0 && (
            <div style={{ padding: '12px 14px', background: 'var(--color-primary-light)', borderRadius: 10, fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 4 }}>Zusammenfassung</div>
              <div style={{ color: 'var(--text-primary)' }}>
                <div>{selected.length} Sitzung{selected.length !== 1 ? 'en' : ''} · {allResolvedLines.length + manualLines.length} Position{(allResolvedLines.length + manualLines.length) !== 1 ? 'en' : ''} · {fmtEUR(totalGross)}</div>
                <div>{form.generateInvoiceDoc ? '✓ Mit Honorarnote' : '– Ohne Honorarnote'}</div>
                <div>{form.markAsPaid ? `✓ Sofort bezahlt (${PAYMENT_LABELS[form.paymentMethod]})` : '⏳ Zahlung ausstehend'}</div>
                <div>Empfänger: {form.payerName || <span style={{ color: 'var(--red)' }}>fehlt!</span>}</div>
              </div>
            </div>
          )}

          <button onClick={submit} disabled={saving || selectedIds.size === 0 || !form.payerName.trim()}
            className="btn-primary" style={{ fontSize: 14, padding: '10px 0', justifyContent: 'center', width: '100%' }}>
            {saving
              ? <><Loader style={{ width: 14, height: 14 }} /> Erstelle Honorarnote...</>
              : <><FileText style={{ width: 14, height: 14 }} /> Honorarnote erstellen</>}
          </button>
        </div>
      </div>
    </div>
  )
}
