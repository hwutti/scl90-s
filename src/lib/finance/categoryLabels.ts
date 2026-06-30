// Gemeinsame Labels für Einnahmen-/Ausgabenkategorien.
// Quelle der Übersetzungen: FinanceClient.tsx (UI) – hier zusätzlich für
// PDF-Export (Steuerberater-Aufstellung) und BMD-Export wiederverwendet.

export const INCOME_CATS: Record<string, string> = {
  HONORAR: 'Honorare',
  OTHER_INCOME: 'Sonstige Einnahmen',
}

export const EXPENSE_CATS: Record<string, string> = {
  MISC_BUSINESS: 'Sonstiger betr. Aufwand',
  GENERAL: 'Allg. Ausgabe',
  SESSION_TRANS: 'Sitzungstransaktion',
  CANCELLATION: 'Storno',
  CONTINUING_ED: 'Fortbildung',
  THERAPY_TRAINING: 'Lehrtherapie',
  TRAVEL: 'Reisekosten',
  OFFICE: 'Büroartikel',
  MARKETING: 'Werbung',
  LITERATURE: 'Literatur',
  FEES_TAXES: 'Gebühren und Abgaben',
  SVA: 'SVA',
  RENT: 'Miete',
  INSURANCE: 'Versicherung',
  CAR: 'Aufwand PKW',
  OPERATIONS: 'Betriebskosten',
  ELECTRICITY: 'Strom',
  PHONE_INTERNET: 'Telefon/Internet',
  CLEANING: 'Reinigung/Verbrauchsmaterial',
  PERSONNEL: 'Personal',
  SUPERVISION: 'Supervision',
  DAILY_ALLOWANCE: 'Taggeld',
  ACCOMMODATION: 'Nächtigungsgeld',
  MILEAGE: 'Kilometergeld',
  DECOR: 'Deko',
}

// Generische Standard-Kontonummern (EKR-orientiert), nur als Startwert gedacht.
// MÜSSEN vor der ersten echten Übermittlung mit dem Steuerberater abgestimmt
// werden – die tatsächlichen Kontonummern variieren von Kanzlei zu Kanzlei.
export const DEFAULT_BMD_EXPENSE_ACCOUNTS: Record<string, string> = {
  MISC_BUSINESS: '7700',
  GENERAL: '7700',
  SESSION_TRANS: '7700',
  CANCELLATION: '7700',
  CONTINUING_ED: '7330',
  THERAPY_TRAINING: '7330',
  TRAVEL: '7345',
  OFFICE: '7600',
  MARKETING: '7650',
  LITERATURE: '7610',
  FEES_TAXES: '7800',
  SVA: '7790',
  RENT: '7400',
  INSURANCE: '7430',
  CAR: '7320',
  OPERATIONS: '7410',
  ELECTRICITY: '7420',
  PHONE_INTERNET: '7660',
  CLEANING: '7470',
  PERSONNEL: '6200',
  SUPERVISION: '7330',
  DAILY_ALLOWANCE: '7345',
  ACCOMMODATION: '7345',
  MILEAGE: '7345',
  DECOR: '7600',
}

export interface BmdSettings {
  erlosUstBefreit: string
  erlosUstPflichtig: string
  ustSatz: number
  expenseAccounts: Record<string, string>
}

export const DEFAULT_BMD_SETTINGS: BmdSettings = {
  erlosUstBefreit: '4000',
  erlosUstPflichtig: '4020',
  ustSatz: 20,
  expenseAccounts: DEFAULT_BMD_EXPENSE_ACCOUNTS,
}

export function parseBmdSettings(json: string | null | undefined): BmdSettings {
  if (!json) return DEFAULT_BMD_SETTINGS
  try {
    const parsed = JSON.parse(json)
    return {
      erlosUstBefreit: parsed.erlosUstBefreit ?? DEFAULT_BMD_SETTINGS.erlosUstBefreit,
      erlosUstPflichtig: parsed.erlosUstPflichtig ?? DEFAULT_BMD_SETTINGS.erlosUstPflichtig,
      ustSatz: parsed.ustSatz ?? DEFAULT_BMD_SETTINGS.ustSatz,
      expenseAccounts: { ...DEFAULT_BMD_EXPENSE_ACCOUNTS, ...(parsed.expenseAccounts ?? {}) },
    }
  } catch {
    return DEFAULT_BMD_SETTINGS
  }
}
