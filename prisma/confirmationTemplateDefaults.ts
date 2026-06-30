// Standard-Bestätigungsvorlagen für österreichische Psychotherapeut*innen.
// Bewusst zurückhaltend formuliert (keine Diagnose-/Behandlungsinhalte ohne
// gesonderte Einwilligung) - Verschwiegenheitspflicht gem. Psychotherapiegesetz.

export interface ConfirmationTemplateDefault {
  templateKey: string
  name: string
  description: string
  bodyText: string
}

export const DEFAULT_CONFIRMATION_TEMPLATES: ConfirmationTemplateDefault[] = [
  {
    templateKey: 'terminbestaetigung',
    name: 'Terminbestätigung',
    description: 'Bestätigt einen vereinbarten/bevorstehenden Termin (z.B. für Dienstgeber).',
    bodyText:
      'Hiermit wird bestätigt, dass für {{patient_name}} am {{sitzungsdatum}} um {{uhrzeit}} Uhr ' +
      'ein Termin in unserer psychotherapeutischen Praxis vereinbart wurde.',
  },
  {
    templateKey: 'anwesenheitsbestaetigung',
    name: 'Anwesenheitsbestätigung',
    description: 'Bestätigt die Wahrnehmung eines bereits stattgefundenen Termins.',
    bodyText:
      'Hiermit wird bestätigt, dass {{patient_name}} am {{sitzungsdatum}} von {{uhrzeit}} Uhr ' +
      '({{dauer}}) einen Termin in unserer psychotherapeutischen Praxis wahrgenommen hat.',
  },
  {
    templateKey: 'behandlungsbestaetigung',
    name: 'Bestätigung über psychotherapeutische Behandlung',
    description: 'Allgemeine Bestätigung eines bestehenden bzw. abgeschlossenen Behandlungsverhältnisses.',
    bodyText:
      'Hiermit wird bestätigt, dass sich {{patient_name}}, geb. {{patient_geburtsdatum}}, ' +
      'in unserer psychotherapeutischen Praxis in Behandlung befindet bzw. befunden hat.',
  },
  {
    templateKey: 'laufende_therapie',
    name: 'Bestätigung einer laufenden Therapie',
    description: 'Bestätigt eine aktuell laufende, noch nicht abgeschlossene Behandlung.',
    bodyText:
      'Hiermit wird bestätigt, dass sich {{patient_name}} aktuell in laufender ' +
      'psychotherapeutischer Behandlung in unserer Praxis befindet.',
  },
  {
    templateKey: 'versicherungsbestaetigung',
    name: 'Bestätigung für Versicherung',
    description: 'Datensparsame Bestätigung für Versicherungen, ohne Diagnose- oder Behandlungsinhalte.',
    bodyText:
      'Hiermit wird auf Anfrage bestätigt, dass {{patient_name}}, geb. {{patient_geburtsdatum}}, ' +
      'sich in unserer psychotherapeutischen Praxis in Behandlung befindet. Nähere Angaben zu ' +
      'Diagnosen oder Behandlungsinhalten unterliegen der psychotherapeutischen ' +
      'Verschwiegenheitspflicht und werden nur mit gesonderter schriftlicher Einwilligung der ' +
      'Patientin / des Patienten weitergegeben.',
  },
  {
    templateKey: 'individuell',
    name: 'Individuelle Bestätigung (Freitext)',
    description: 'Leere Vorlage für frei formulierte Bestätigungen.',
    bodyText: '',
  },
]
