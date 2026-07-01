// Globale Avatar-Zuordnung je Patienten-Gruppe (Geschlecht + Paar/Familie/Gruppe).
// Wird EINMALIG unter Einstellungen festgelegt (nicht pro Patient) — alle
// Patient:innen derselben Gruppe zeigen denselben DiceBear-Avatar.

export type AvatarGroup = 'MALE' | 'FEMALE' | 'DIVERSE' | 'PAIR' | 'FAMILY' | 'GROUP'

export interface AvatarSettings {
  seeds: Record<AvatarGroup, string>
}

export const AVATAR_GROUP_LABELS: Record<AvatarGroup, string> = {
  MALE: 'Männlich',
  FEMALE: 'Weiblich',
  DIVERSE: 'Divers',
  PAIR: 'Paar',
  FAMILY: 'Familie',
  GROUP: 'Gruppe',
}

export const DEFAULT_AVATAR_SETTINGS: AvatarSettings = {
  seeds: {
    MALE: 'kds-male-default',
    FEMALE: 'kds-female-default',
    DIVERSE: 'kds-diverse-default',
    PAIR: 'kds-pair-default',
    FAMILY: 'kds-family-default',
    GROUP: 'kds-group-default',
  },
}

export function parseAvatarSettings(json: string | null | undefined): AvatarSettings {
  if (!json) return DEFAULT_AVATAR_SETTINGS
  try {
    const parsed = JSON.parse(json)
    return {
      seeds: { ...DEFAULT_AVATAR_SETTINGS.seeds, ...(parsed.seeds ?? {}) },
    }
  } catch {
    return DEFAULT_AVATAR_SETTINGS
  }
}

/**
 * Erzeugt den DiceBear-"Avataaars"-SVG-String für einen Seed. Läuft NUR
 * serverseitig (Node.js) — liest die Style-Definition direkt per fs von der
 * Platte statt per ESM-JSON-Import (Import-Attribute werden je nach Next.js/
 * Webpack-Version nicht zuverlässig unterstützt; fs.readFileSync ist
 * unabhängig vom Modul-System und dadurch robuster).
 */
let cachedDefinition: any = null

export async function generateAvatarSvg(seed: string, backgroundColor?: string): Promise<string> {
  const { Style, Avatar } = await import('@dicebear/core')

  if (!cachedDefinition) {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const definitionPath = join(process.cwd(), 'node_modules', '@dicebear', 'styles', 'dist', 'avataaars.min.json')
    cachedDefinition = JSON.parse(readFileSync(definitionPath, 'utf-8'))
  }

  const style = new Style(cachedDefinition)
  const avatar = new Avatar(style, {
    seed,
    ...(backgroundColor ? { backgroundColor: [backgroundColor.replace('#', '')] } : {}),
  })
  return avatar.toString()
}
