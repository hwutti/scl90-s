import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const user = session.user as any

  return (
    <PageShell>
      <h1 className="text-2xl font-bold text-slate-800">Mein Profil</h1>
      <div className="card p-6 max-w-md space-y-3">
        {[
          ['Name',  user.name  ?? '—'],
          ['E-Mail', user.email ?? '—'],
          ['Rolle',  user.role  ?? '—'],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between text-sm border-b border-slate-50 pb-3 last:border-0 last:pb-0">
            <span className="text-slate-400">{l}</span>
            <span className="font-medium text-slate-700">{v}</span>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
