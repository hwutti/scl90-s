
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Euro, Calendar, FileText, TrendingUp, Clock,
  AlertCircle, CheckCircle, Plus, ChevronRight, RefreshCw,
  Activity, ClipboardList, MessageSquare
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

function fmtEUR(n: any) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(parseFloat(n?.toString() ?? '0'))
}
function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(d))
}

const BILLING_COLORS: Record<string,string> = {
  UNBILLED: 'var(--amber)', BILLED_UNPAID: 'var(--blue)',
  PAID: 'var(--green)', EXCLUDED: 'var(--text-muted)',
}
const BILLING_LABELS: Record<string,string> = {
  UNBILLED: 'Nicht verrechnet', BILLED_UNPAID: 'Offen',
  PAID: 'Bezahlt', EXCLUDED: 'Ausgeschlossen',
}

export function DashboardHomeClient({ role, userName }: { role: string; userName: string }) {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch('/api/dashboard').then(r => r.json())
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Load saved note
    const saved = localStorage.getItem('kds-dashboard-note')
    if (saved) setNote(saved)
    // Auto-refresh every 60s
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  }

  const s = data?.stats
  const pieDataPatients = s ? [
    { name: 'Aktiv', value: s.activePatients, color: 'var(--green)' },
    { name: 'Inaktiv', value: s.totalPatients - s.activePatients, color: 'var(--text-muted)' },
  ] : []
  const pieDataSessions = s ? [
    { name: 'Bezahlt', value: s.totalSessions - s.unbilledCount, color: 'var(--green)' },
    { name: 'Offen', value: s.unbilledCount, color: 'var(--amber)' },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {greeting()}, {userName.split(' ')[0]}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {new Intl.DateTimeFormat('de-AT', { weekday: 'long', dateStyle: 'full' }).format(new Date())}
          </p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
        </button>
        <button onClick={() => router.push('/patients/new')} className="btn-primary">
          <Plus style={{ width: 13, height: 13 }} /> Neuer Patient
        </button>
      </div>

      <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
        {loading && !data ? (
          <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── KPI Karten ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Patienten', value: s?.totalPatients ?? 0, sub: `${s?.activePatients ?? 0} aktiv`, icon: Users, color: 'var(--color-primary)', bg: 'var(--color-primary-light)', link: '/patients' },
                { label: 'Sitzungen diesen Monat', value: s?.sessionsThisMonth ?? 0, sub: `${s?.totalSessions ?? 0} gesamt`, icon: ClipboardList, color: 'var(--green)', bg: 'var(--green-bg)', link: null },
                { label: 'Offener Betrag', value: fmtEUR(s?.unpaidAmount ?? 0), sub: `${s?.unbilledCount ?? 0} nicht verrechnet`, icon: Euro, color: 'var(--red)', bg: 'var(--red-bg)', link: '/finance' },
                { label: 'Termine heute', value: s?.todayAppointments ?? 0, sub: `${s?.upcomingAppointments ?? 0} bevorstehend`, icon: Calendar, color: 'var(--amber)', bg: 'var(--amber-bg)', link: '/calendar' },
              ].map(k => (
                <div key={k.label} className="stat-card" style={{ cursor: k.link ? 'pointer' : 'default' }}
                  onClick={() => k.link && router.push(k.link)}>
                  <div className="stat-icon" style={{ background: k.bg }}>
                    <k.icon style={{ width: 15, height: 15, stroke: k.color, fill: 'none' }} />
                  </div>
                  <div className="stat-value" style={{ color: k.color, fontSize: 20 }}>{k.value}</div>
                  <div className="stat-label">{k.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Aktivitätsdiagramm + Statistiken ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
              {/* Bar Chart */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Meine Aktivität</h2>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Letzte 14 Tage</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data?.activity ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                    onClick={(d: any) => d?.activeLabel && setSelectedDay(d.activeLabel)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="datum" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-card)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}
                      formatter={(value: any, name: string) => [value, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="sitzungen" name="Sitzungen" fill="var(--color-primary)" radius={[3,3,0,0]} />
                    <Bar dataKey="transaktionen" name="Transaktionen" fill="var(--blue)" radius={[3,3,0,0]} />
                    <Bar dataKey="termine" name="Termine" fill="var(--amber)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, minHeight: 20 }}>
                  {selectedDay ? `Ausgewählter Tag: ${selectedDay}` : 'Balken anklicken für Details'}
                </div>
              </div>

              {/* Pie Charts */}
              <div className="card" style={{ padding: 16 }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Statistiken</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Profile</p>
                    <PieChart width={140} height={130}>
                      <Pie data={pieDataPatients} cx={65} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                        {pieDataPatients.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, '']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    </PieChart>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {pieDataPatients.map(d => (
                        <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }}/>
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Sitzungen</p>
                    <PieChart width={140} height={130}>
                      <Pie data={pieDataSessions} cx={65} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                        {pieDataSessions.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, '']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    </PieChart>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {pieDataSessions.map(d => (
                        <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }}/>
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, padding: '8px 0', borderTop: '0.5px solid var(--border)' }}>
                  <div>Sitzungen gesamt: <strong>{s?.totalSessions ?? 0}</strong></div>
                  <div>Nicht verrechnet: <strong style={{ color: 'var(--amber)' }}>{s?.unbilledCount ?? 0}</strong></div>
                  <div>Offener Betrag: <strong style={{ color: 'var(--red)' }}>{fmtEUR(s?.unpaidAmount ?? 0)}</strong></div>
                </div>
              </div>
            </div>

            {/* ── Letzte Sitzungen + Notizfeld ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Letzte Sitzungen */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Letzte Sitzungen</h2>
                  <button onClick={() => router.push('/patients')} className="btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}>
                    Alle <ChevronRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                {!data?.recentSessions?.length ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <ClipboardList className="empty-state-icon" style={{ width: 28, height: 28 }} />
                    <p className="empty-state-text">Noch keine Sitzungen.</p>
                  </div>
                ) : (
                  <div>
                    {data.recentSessions.map((s: any) => (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 16px', borderBottom: '0.5px solid var(--border)',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => (e.currentTarget as any).style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => (e.currentTarget as any).style.background = ''}
                        onClick={() => router.push('/patients')}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.patientName}
                            {s.codeName && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6, fontFamily: 'monospace' }}>{s.codeName}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fmtDate(s.sessionDate)} · {s.name}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: BILLING_COLORS[s.billingStatus] ?? 'var(--text-muted)' }}>
                            {BILLING_LABELS[s.billingStatus] ?? s.billingStatus}
                          </span>
                          {s.calculatedPriceNet && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtEUR(s.calculatedPriceNet)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notizfeld */}
              <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare style={{ width: 15, height: 15, stroke: 'var(--color-primary)', fill: 'none' }} />
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Meine Notizen</h2>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>wird lokal gespeichert</span>
                </div>
                <textarea
                  value={note}
                  onChange={e => { setNote(e.target.value); localStorage.setItem('kds-dashboard-note', e.target.value) }}
                  placeholder="Notizen zwischen Sitzungen, Erinnerungen, To-Dos..."
                  style={{
                    flex: 1, minHeight: 180, resize: 'none',
                    padding: '10px 12px', borderRadius: 8,
                    border: '0.5px solid var(--border-strong)',
                    background: 'var(--surface-input)',
                    color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
                />

                {/* Schnellzugriff */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Schnellzugriff</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'Neuer Patient', icon: Users, link: '/patients' },
                      { label: 'Neue Sitzung', icon: ClipboardList, link: '/patients' },
                      { label: 'Kalender', icon: Calendar, link: '/calendar' },
                      { label: 'Finanzen', icon: Euro, link: '/finance' },
                    ].map(item => (
                      <button key={item.label} onClick={() => router.push(item.link)}
                        className="btn-secondary" style={{ fontSize: 12, justifyContent: 'flex-start', padding: '6px 10px' }}>
                        <item.icon style={{ width: 13, height: 13 }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
