import { redirect } from 'next/navigation'
export default function LegacyResultsPage({ params }: { params: { id: string } }) {
  redirect(`/assessment/${params.id}/results`)
}
