import type { EnrichedKundenabrechnung } from '@/types/enriched';
import type { Kundenabrechnung, Testeingabe } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface KundenabrechnungMaps {
  testeingabeMap: Map<string, Testeingabe>;
}

export function enrichKundenabrechnung(
  kundenabrechnung: Kundenabrechnung[],
  maps: KundenabrechnungMaps
): EnrichedKundenabrechnung[] {
  return kundenabrechnung.map(r => ({
    ...r,
    kunde_refName: resolveDisplay(r.fields.kunde_ref, maps.testeingabeMap, 'vorname', 'nachname'),
  }));
}
