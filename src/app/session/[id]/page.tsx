import { redirect } from 'next/navigation'
export default function LegacySessionPage({ params }: { params: { id: string } }) {
  redirect(`/assessment/${params.id}`)
}
