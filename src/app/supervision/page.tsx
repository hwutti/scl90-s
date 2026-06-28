import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SupervisionClient } from './SupervisionClient'

export default async function SupervisionPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role === 'PATIENT') redirect('/my')
  return <SupervisionClient />
}
