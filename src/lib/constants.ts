// SCL-90-S Items (90 Stück)
export const ITEMS: string[] = [
  "Kopfschmerzen",
  "Nervosität oder innerem Zittern",
  "immer wieder auftauchenden unerwünschten Gedanken, Worten oder Ideen, die Ihnen nicht mehr aus dem Kopf gehen",
  "Ohnmachts- und Schwindelgefühlen",
  "Verminderung Ihres Interesses oder Ihrer Freude an Sexualität",
  "allzu kritischer Einstellung gegenüber anderen",
  "der Idee, dass irgendjemand Macht über Ihre Gedanken hat",
  "dem Gefühl, dass andere an den meisten Ihrer Schwierigkeiten schuld sind",
  "Gedächtnisschwierigkeiten",
  "Beunruhigung wegen Achtlosigkeit und Nachlässigkeit",
  "dem Gefühl, leicht reizbar oder verärgerbar zu sein",
  "Herz- und Brustschmerzen",
  "Furcht auf offenen Plätzen oder auf der Straße",
  "Energielosigkeit oder Verlangsamung in den Bewegungen oder im Denken",
  "Gedanken, sich das Leben zu nehmen",
  "Hören von Stimmen, die sonst keiner hört",
  "Zittern",
  "dem Gefühl, dass man den meisten Leuten nicht trauen kann",
  "schlechtem Appetit",
  "Neigung zum Weinen",
  "Schüchternheit oder Unbeholfenheit im Umgang mit dem anderen Geschlecht",
  "der Befürchtung, ertappt oder erwischt zu werden",
  "plötzlichem Erschrecken ohne Grund",
  "Gefühlsausbrüchen, denen gegenüber Sie machtlos waren",
  "Befürchtungen, wenn Sie alleine aus dem Haus gehen",
  "Selbstvorwürfen über bestimmte Dinge",
  "Kreuzschmerzen",
  "dem Gefühl, dass es Ihnen schwerfällt, etwas anzufangen",
  "Einsamkeitsgefühlen",
  "Schwermut",
  "dem Gefühl, sich zu viele Sorgen machen zu müssen",
  "dem Gefühl, sich für nichts zu interessieren",
  "Furchtsamkeit",
  "Verletzlichkeit in Gefühlsdingen",
  "der Idee, dass andere Leute von Ihren geheimsten Gedanken wissen",
  "dem Gefühl, dass andere Sie nicht verstehen oder teilnahmslos sind",
  "dem Gefühl, dass die Leute unfreundlich sind oder Sie nicht leiden können",
  "der Notwendigkeit, alles sehr langsam zu tun, um sicher zu sein, dass alles richtig ist",
  "Herzklopfen oder Herzjagen",
  "Übelkeit oder Magenverstimmung",
  "Minderwertigkeitsgefühlen anderen gegenüber",
  "Muskelschmerzen (Muskelkater, Gliederreißen)",
  "dem Gefühl, dass andere Sie beobachten oder über Sie reden",
  "Einschlafschwierigkeiten",
  "dem Zwang, wieder und wieder nachzukontrollieren, was Sie tun",
  "Schwierigkeiten, sich zu entscheiden",
  "Furcht vor Fahrten in Bus, Straßenbahn, U-Bahn oder Zug",
  "Schwierigkeiten beim Atmen",
  "Hitzewallungen oder Kälteschauern",
  "der Notwendigkeit, bestimmte Dinge, Orte oder Tätigkeiten zu meiden, weil Sie durch diese erschreckt werden",
  "Leere im Kopf",
  "Taubheit oder Kribbeln in einzelnen Körperteilen",
  "dem Gefühl, einen Klumpen (Kloß) im Hals zu haben",
  "einem Gefühl der Hoffnungslosigkeit angesichts der Zukunft",
  "Konzentrationsschwierigkeiten",
  "Schwächegefühl in einzelnen Körperteilen",
  "dem Gefühl, gespannt oder aufgeregt zu sein",
  "Schweregefühl in den Armen oder den Beinen",
  "Gedanken an den Tod und ans Sterben",
  "dem Drang, sich zu überessen",
  "einem unbehaglichen Gefühl, wenn Leute Sie beobachten oder über Sie reden",
  "dem Auftauchen von Gedanken, die nicht Ihre eigenen sind",
  "dem Drang, jemanden zu schlagen, zu verletzen oder ihm Schmerz zuzufügen",
  "frühem Erwachen am Morgen",
  "zwanghafter Wiederholung derselben Tätigkeit wie Berühren, Zählen, Waschen",
  "unruhigem oder gestörtem Schlaf",
  "dem Drang, Dinge zu zerbrechen oder zu zerschmettern",
  "Ideen oder Anschauungen, die andere nicht mit Ihnen teilen",
  "starker Befangenheit im Umgang mit anderen",
  "Abneigung gegen Menschenmengen, z.B. beim Einkaufen oder im Kino",
  "einem Gefühl, dass alles sehr anstrengend ist",
  "Schreck- oder Panikanfällen",
  "Unbehagen beim Essen oder Trinken in der Öffentlichkeit",
  "der Neigung, immer wieder in Erörterungen oder Auseinandersetzungen zu geraten",
  "Nervosität, wenn Sie allein gelassen werden",
  "mangelnder Anerkennung Ihrer Leistungen durch andere",
  "Einsamkeitsgefühlen, selbst wenn Sie in Gesellschaft sind",
  "so starker Ruhelosigkeit, dass Sie nicht stillsitzen können",
  "dem Gefühl, wertlos zu sein",
  "dem Gefühl, dass Ihnen schlimme oder eigenartige Dinge passieren werden",
  "dem Bedürfnis, laut zu schreien oder mit Gegenständen zu werfen",
  "der Furcht, in der Öffentlichkeit in Ohnmacht zu fallen",
  "dem Gefühl, dass die Leute Sie ausnutzen, wenn Sie es zulassen würden",
  "sexuellen Vorstellungen, die ziemlich unangenehm für Sie sind",
  "dem Gedanken, dass Sie für Ihre Sünden bestraft werden sollten",
  "Vorstellungen und Gedanken, die Ihnen Angst einflößen",
  "dem Gedanken, dass etwas ernstlich mit Ihrem Körper nicht in Ordnung ist",
  "dem Eindruck, sich einer anderen Person nie so richtig nahe fühlen zu können",
  "Schuldgefühlen",
  "dem Gedanken, dass irgendetwas mit Ihrem Verstand nicht in Ordnung ist",
]

export interface ScaleDef {
  id: string
  name: string
  shortName: string
  items: number[]   // 1-basiert
  isAddOn?: boolean
}

export const SCALES: ScaleDef[] = [
  { id: 'SOM', name: 'Somatisierung',                    shortName: 'SOM', items: [1,4,12,27,40,42,48,49,52,53,56,58] },
  { id: 'ZWA', name: 'Zwanghaftigkeit',                  shortName: 'ZWA', items: [3,9,10,28,38,45,46,51,55,65] },
  { id: 'UNS', name: 'Unsicherheit im Sozialkontakt',    shortName: 'UNS', items: [6,21,34,36,37,41,61,69,73] },
  { id: 'DEP', name: 'Depressivität',                    shortName: 'DEP', items: [5,14,15,20,22,26,29,30,31,32,54,71,79] },
  { id: 'ANG', name: 'Ängstlichkeit',                    shortName: 'ANG', items: [2,17,23,33,39,57,72,78,80,86] },
  { id: 'AGG', name: 'Aggressivität / Feindseligkeit',   shortName: 'AGG', items: [11,24,63,67,74,81] },
  { id: 'PHO', name: 'Phobische Angst',                  shortName: 'PHO', items: [13,25,47,50,70,75,82] },
  { id: 'PAR', name: 'Paranoides Denken',                shortName: 'PAR', items: [8,18,43,68,76,83] },
  { id: 'PSY', name: 'Psychotizismus',                   shortName: 'PSY', items: [7,16,35,62,77,84,85,87,88,90] },
  { id: 'ZUS', name: 'Zusatzitems',                      shortName: 'ZUS', items: [19,44,59,60,64,66,89], isAddOn: true },
]

// Item → Skalen Mapping
export const ITEM_TO_SCALES = new Map<number, string[]>()
for (const s of SCALES) {
  for (const n of s.items) {
    const arr = ITEM_TO_SCALES.get(n) ?? []
    arr.push(s.id)
    ITEM_TO_SCALES.set(n, arr)
  }
}

export const SCORE_LABELS = ['gar nicht', 'ein wenig', 'mäßig', 'ziemlich', 'sehr stark']

export const RISK_THRESHOLDS = { green: 0.50, yellow: 1.50 }

export const T_BANDS = [
  { max: 40,       label: 'Unterdurchschnittlich / unauffällig' },
  { max: 50,       label: 'Durchschnittlicher Bereich' },
  { max: 60,       label: 'Leicht überdurchschnittlich' },
  { max: 70,       label: 'Deutlich erhöht – möglicherweise klinisch relevant' },
  { max: Infinity, label: 'Sehr hohe Werte – starke Auffälligkeit' },
]
