import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { PraxisModusClient } from './PraxisModusClient'
import { DEFAULT_ADMIN_PERMISSIONS } from '@/lib/access'

export default async function PraxisModusPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const config = await prisma.praxisConfig.findFirst({ where: { key: 'default' } })
  const mode = config?.practiceMode ?? 'single'
  let perms = { ...DEFAULT_ADMIN_PERMISSIONS }
  if (config?.adminPermissions) {
    try { perms = { ...perms, ...JSON.parse(config.adminPermissions) } } catch {}
  }

  // Alle Therapeuten für Übersicht
  const therapists = await prisma.user.findMany({
    where: { role: 'THERAPIST', active: true },
    select: { id: true, name: true, email: true,
      _count: { select: { therapistPatients: true, therapySessions: true } }
    },
    orderBy: { name: 'asc' },
  })

  return (
    <PageShell>
      <PraxisModusClient
        initialMode={mode}
        initialPerms={perms}
        therapists={therapists as any}
      />
    </PageShell>
  )
}
