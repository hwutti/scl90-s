import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { SmtpConfigClient } from './SmtpConfigClient'

export default async function SmtpConfigPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const config = await prisma.smtpConfig.findFirst({ where: { isActive: true } })
  const { password, ...safeConfig } = config ?? ({} as any)

  return (
    <PageShell>
      <SmtpConfigClient
        initialConfig={config ? { ...safeConfig, passwordSet: !!password } : null}
        adminEmail={session.user?.email ?? ''}
      />
    </PageShell>
  )
}
