// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Testeingabe {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    bemerkungen?: string;
  };
}

export interface Kundenabrechnung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde_ref?: string; // applookup -> URL zu 'Testeingabe' Record
    rechnungsnummer?: string;
    leistungsbeschreibung?: string;
    menge?: number;
    einzelpreis?: number;
    gesamtbetrag?: number;
    zahlungsart?: LookupValue;
    faelligkeit?: string; // Format: YYYY-MM-DD oder ISO String
    hinweise?: string;
  };
}

export const APP_IDS = {
  TESTEINGABE: '69c1113a299eba5cd97468cd',
  KUNDENABRECHNUNG: '69c11fe6d96798d207f9c76b',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  kundenabrechnung: {
    zahlungsart: [{ key: "ueberweisung", label: "Überweisung" }, { key: "barzahlung", label: "Barzahlung" }, { key: "kreditkarte", label: "Kreditkarte" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'testeingabe': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'geburtsdatum': 'date/date',
    'bemerkungen': 'string/textarea',
  },
  'kundenabrechnung': {
    'kunde_ref': 'applookup/select',
    'rechnungsnummer': 'string/text',
    'leistungsbeschreibung': 'string/text',
    'menge': 'number',
    'einzelpreis': 'number',
    'gesamtbetrag': 'number',
    'zahlungsart': 'lookup/select',
    'faelligkeit': 'date/date',
    'hinweise': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateTesteingabe = StripLookup<Testeingabe['fields']>;
export type CreateKundenabrechnung = StripLookup<Kundenabrechnung['fields']>;