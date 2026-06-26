import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

export function calcAge(dobStr: string | null | undefined): number | null {
  if (!dobStr) return null
  const dob = new Date(dobStr + 'T00:00:00')
  if (isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  if (now.getMonth() - dob.getMonth() < 0 ||
     (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--
  return age
}

export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
