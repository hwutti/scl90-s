// Österreichische Bundesfeiertage (fix + beweglich)
// Schulferien nach Bundesland

export interface Holiday {
  date: string  // YYYY-MM-DD
  name: string
  type: 'public' | 'school'
}

// Ostersonntag berechnen (Gaußsche Osterformel)
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getPublicHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  return [
    { date: `${year}-01-01`, name: 'Neujahr',                        type: 'public' },
    { date: `${year}-01-06`, name: 'Heilige Drei Könige',            type: 'public' },
    { date: fmt(addDays(easter, -2)), name: 'Karfreitag',            type: 'public' },
    { date: fmt(easter),             name: 'Ostersonntag',           type: 'public' },
    { date: fmt(addDays(easter, 1)), name: 'Ostermontag',            type: 'public' },
    { date: `${year}-05-01`, name: 'Staatsfeiertag',                 type: 'public' },
    { date: fmt(addDays(easter, 39)), name: 'Christi Himmelfahrt',   type: 'public' },
    { date: fmt(addDays(easter, 49)), name: 'Pfingstsonntag',        type: 'public' },
    { date: fmt(addDays(easter, 50)), name: 'Pfingstmontag',         type: 'public' },
    { date: fmt(addDays(easter, 60)), name: 'Fronleichnam',          type: 'public' },
    { date: `${year}-08-15`, name: 'Mariä Himmelfahrt',              type: 'public' },
    { date: `${year}-10-26`, name: 'Nationalfeiertag',               type: 'public' },
    { date: `${year}-11-01`, name: 'Allerheiligen',                  type: 'public' },
    { date: `${year}-12-08`, name: 'Mariä Empfängnis',               type: 'public' },
    { date: `${year}-12-25`, name: 'Weihnachten',                    type: 'public' },
    { date: `${year}-12-26`, name: 'Stefanitag',                     type: 'public' },
  ]
}

// Schulferien nach Bundesland (2025/26 + 2026/27)
// Quellen: BMBWF Ferienkalender
const SCHOOL_HOLIDAYS: Record<string, Array<{ from: string; to: string; name: string }>> = {
  Kärnten: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-02-14', to: '2026-02-22', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-05-23', to: '2026-05-23', name: 'Zwickeltag' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Wien: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-02-07', to: '2026-02-15', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Steiermark: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-01-31', to: '2026-02-08', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Salzburg: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-02-14', to: '2026-02-22', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Tirol: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-01-31', to: '2026-02-08', name: 'Semesterferien' },
    { from: '2026-03-28', to: '2026-04-12', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Vorarlberg: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-01-31', to: '2026-02-08', name: 'Semesterferien' },
    { from: '2026-03-28', to: '2026-04-12', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Burgenland: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-02-07', to: '2026-02-15', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Niederösterreich: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-02-07', to: '2026-02-15', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
  Oberösterreich: [
    { from: '2025-10-25', to: '2025-11-02', name: 'Herbstferien' },
    { from: '2025-12-24', to: '2026-01-06', name: 'Weihnachtsferien' },
    { from: '2026-01-31', to: '2026-02-08', name: 'Semesterferien' },
    { from: '2026-04-04', to: '2026-04-19', name: 'Osterferien' },
    { from: '2026-06-29', to: '2026-08-31', name: 'Sommerferien' },
    { from: '2026-10-24', to: '2026-11-01', name: 'Herbstferien' },
    { from: '2026-12-24', to: '2027-01-06', name: 'Weihnachtsferien' },
  ],
}

export const BUNDESLAENDER = Object.keys(SCHOOL_HOLIDAYS)

export function getSchoolHolidays(year: number, bundesland: string): Holiday[] {
  const periods = SCHOOL_HOLIDAYS[bundesland] ?? []
  const result: Holiday[] = []

  for (const period of periods) {
    const from = new Date(period.from)
    const to   = new Date(period.to)
    const cur  = new Date(from)

    while (cur <= to) {
      if (cur.getFullYear() === year || (cur.getFullYear() === year - 1 && cur.getMonth() >= 6)) {
        result.push({ date: fmt(cur), name: period.name, type: 'school' })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }
  return result
}

export function getAllHolidays(year: number, bundesland: string): Holiday[] {
  return [...getPublicHolidays(year), ...getSchoolHolidays(year, bundesland)]
}

export function getHolidayMap(year: number, bundesland: string): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>()
  for (const h of getAllHolidays(year, bundesland)) {
    const existing = map.get(h.date) ?? []
    existing.push(h)
    map.set(h.date, existing)
  }
  return map
}
