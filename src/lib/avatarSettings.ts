// Globale Avatar-Zuordnung je Patienten-Gruppe (Geschlecht + Paar/Familie/Gruppe).
// Wird EINMALIG unter Einstellungen festgelegt (nicht pro Patient) — alle
// Patient:innen derselben Gruppe zeigen denselben DiceBear-Avatar.
//
// WICHTIG: DiceBear "Avataaars" zeichnet immer nur EINE Person. Für PAIR/FAMILY/
// GROUP wird der Seed-String daher als kommagetrennte Liste MEHRERER Einzel-Seeds
// gespeichert (z.B. "abc,def" für ein Paar) und beim Rendern zu einem Bild mit
// mehreren Gesichtern zusammengesetzt (siehe generateGroupAvatarSvg).

export type AvatarGroup = 'MALE' | 'FEMALE' | 'DIVERSE' | 'CHILD' | 'PAIR' | 'FAMILY' | 'GROUP'
export type AvatarStyle = 'dicebear' | 'illustrated'

export interface AvatarSettings {
  style: AvatarStyle
  seeds: Record<AvatarGroup, string>
  /** Bei style === 'illustrated': Dateiname (ohne Pfad) je Gruppe, z.B. "ind07.png"
   *  für Einzelpersonen/Kinder oder "grp03.png" für ein fertiges Paar/Familie/Gruppe-Bild.
   *  Liegt unter /public/avatars/illustrated/{individuals|kids|groups}/. */
  illustrated: Record<AvatarGroup, string>
}

export const AVATAR_GROUP_LABELS: Record<AvatarGroup, string> = {
  MALE: 'Männlich',
  FEMALE: 'Weiblich',
  DIVERSE: 'Divers',
  CHILD: 'Kind',
  PAIR: 'Paar',
  FAMILY: 'Familie',
  GROUP: 'Gruppe',
}

// Welcher Bild-Pool (Ordner unter /public/avatars/illustrated) für die Kachel-
// Auswahl einer Gruppe verwendet wird, wenn style === 'illustrated'.
export const AVATAR_GROUP_POOL: Record<AvatarGroup, 'individuals' | 'kids' | 'groups'> = {
  MALE: 'individuals',
  FEMALE: 'individuals',
  DIVERSE: 'individuals',
  CHILD: 'kids',
  PAIR: 'groups',
  FAMILY: 'groups',
  GROUP: 'groups',
}

// Wie viele Einzelpersonen je Mehrpersonen-Gruppe kombiniert werden (nur relevant
// für style === 'dicebear' — bei 'illustrated' ist es ein fertiges Einzelbild).
export const AVATAR_GROUP_PERSON_COUNT: Partial<Record<AvatarGroup, number>> = {
  PAIR: 2,
  FAMILY: 3,
  GROUP: 4,
}

export const DEFAULT_AVATAR_SETTINGS: AvatarSettings = {
  style: 'dicebear',
  seeds: {
    MALE: 'kds-male-default',
    FEMALE: 'kds-female-default',
    DIVERSE: 'kds-diverse-default',
    CHILD: 'kds-child-default',
    PAIR: 'kds-pair-default-a,kds-pair-default-b',
    FAMILY: 'kds-family-default-a,kds-family-default-b,kds-family-default-c',
    GROUP: 'kds-group-default-a,kds-group-default-b,kds-group-default-c,kds-group-default-d',
  },
  illustrated: {
    MALE: 'ind04.png',
    FEMALE: 'ind01.png',
    DIVERSE: 'ind13.png',
    CHILD: 'kid01.png',
    PAIR: 'grp01.png',
    FAMILY: 'grp04.png',
    GROUP: 'grp05.png',
  },
}

// Statische Kandidatenlisten für die "Illustriert"-Kachel-Auswahl (deterministische
// Dateinamen, siehe /public/avatars/illustrated/*). Ohne fs-Zugriff nutzbar, damit
// auch die Client-Komponente (SettingsClient.tsx) sie direkt importieren kann.
export const AVATAR_ILLUSTRATED_POOLS: Record<'individuals' | 'kids' | 'groups', string[]> = {
  individuals: Array.from({ length: 39 }, (_, i) => `ind${String(i + 1).padStart(2, '0')}.png`),
  kids: Array.from({ length: 13 }, (_, i) => `kid${String(i + 1).padStart(2, '0')}.png`),
  groups: Array.from({ length: 13 }, (_, i) => `grp${String(i + 1).padStart(2, '0')}.png`),
}

export function illustratedAvatarSrc(group: AvatarGroup, filename: string): string {
  return `/avatars/illustrated/${AVATAR_GROUP_POOL[group]}/${filename}`
}

export function parseAvatarSettings(json: string | null | undefined): AvatarSettings {
  if (!json) return DEFAULT_AVATAR_SETTINGS
  try {
    const parsed = JSON.parse(json)
    return {
      style: parsed.style === 'illustrated' ? 'illustrated' : 'dicebear',
      seeds: { ...DEFAULT_AVATAR_SETTINGS.seeds, ...(parsed.seeds ?? {}) },
      illustrated: { ...DEFAULT_AVATAR_SETTINGS.illustrated, ...(parsed.illustrated ?? {}) },
    }
  } catch {
    return DEFAULT_AVATAR_SETTINGS
  }
}
