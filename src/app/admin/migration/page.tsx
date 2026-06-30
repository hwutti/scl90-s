import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MigrationClient } from './MigrationClient'

export const metadata = { title: 'TheraPsy-Migration' }

export default async function MigrationPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') redirect('/patients')
  return <MigrationClient />
}
