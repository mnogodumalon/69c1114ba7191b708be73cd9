import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Testeingabe, Kundenabrechnung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [testeingabe, setTesteingabe] = useState<Testeingabe[]>([]);
  const [kundenabrechnung, setKundenabrechnung] = useState<Kundenabrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [testeingabeData, kundenabrechnungData] = await Promise.all([
        LivingAppsService.getTesteingabe(),
        LivingAppsService.getKundenabrechnung(),
      ]);
      setTesteingabe(testeingabeData);
      setKundenabrechnung(kundenabrechnungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [testeingabeData, kundenabrechnungData] = await Promise.all([
          LivingAppsService.getTesteingabe(),
          LivingAppsService.getKundenabrechnung(),
        ]);
        setTesteingabe(testeingabeData);
        setKundenabrechnung(kundenabrechnungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const testeingabeMap = useMemo(() => {
    const m = new Map<string, Testeingabe>();
    testeingabe.forEach(r => m.set(r.record_id, r));
    return m;
  }, [testeingabe]);

  return { testeingabe, setTesteingabe, kundenabrechnung, setKundenabrechnung, loading, error, fetchAll, testeingabeMap };
}