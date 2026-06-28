import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { VideoCallsClient } from './VideoCallsClient'

export default async function VideoCallsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any).role === 'PATIENT') redirect('/my')
  return <VideoCallsClient />
}
