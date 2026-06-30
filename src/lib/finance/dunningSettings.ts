export interface DunningSettings {
  erinnerungDays: number   // Tage nach Faelligkeit bis Zahlungserinnerung vorgeschlagen wird
  mahnung1Days: number     // Tage nach der Erinnerung bis 1. Mahnung vorgeschlagen wird
  mahnung2Days: number     // Tage nach der 1. Mahnung bis 2. Mahnung vorgeschlagen wird
}

export const DEFAULT_DUNNING_SETTINGS: DunningSettings = {
  erinnerungDays: 7,
  mahnung1Days: 14,
  mahnung2Days: 14,
}

export function parseDunningSettings(json: string | null | undefined): DunningSettings {
  if (!json) return DEFAULT_DUNNING_SETTINGS
  try {
    const parsed = JSON.parse(json)
    return {
      erinnerungDays: Number(parsed.erinnerungDays) || DEFAULT_DUNNING_SETTINGS.erinnerungDays,
      mahnung1Days: Number(parsed.mahnung1Days) || DEFAULT_DUNNING_SETTINGS.mahnung1Days,
      mahnung2Days: Number(parsed.mahnung2Days) || DEFAULT_DUNNING_SETTINGS.mahnung2Days,
    }
  } catch {
    return DEFAULT_DUNNING_SETTINGS
  }
}

export const DUNNING_LEVEL_LABELS: Record<string, string> = {
  ERINNERUNG: 'Zahlungserinnerung',
  MAHNUNG_1: '1. Mahnung',
  MAHNUNG_2: '2. Mahnung',
}

export const DUNNING_LEVEL_ORDER = ['ERINNERUNG', 'MAHNUNG_1', 'MAHNUNG_2'] as const
