import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { NormTablesClient } from './NormTablesClient'

export default async function NormTablesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  const tables = await prisma.normTable.findMany({ orderBy: { createdAt: 'desc' } })
  return (
    <div className="flex-1 flex flex-col">
      <NormTablesClient tables={tables.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))} />
    </div>
  )
}
