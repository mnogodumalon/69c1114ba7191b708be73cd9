import type { Kundenabrechnung } from './app';

export type EnrichedKundenabrechnung = Kundenabrechnung & {
  kunde_refName: string;
};
