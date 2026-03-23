import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichKundenabrechnung } from '@/lib/enrich';
import type { EnrichedKundenabrechnung } from '@/types/enriched';
import type { Testeingabe, Kundenabrechnung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TesteingabeDialog } from '@/components/dialogs/TesteingabeDialog';
import { KundenabrechnungDialog } from '@/components/dialogs/KundenabrechnungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconUsers, IconFileText, IconPlus, IconPencil, IconTrash,
  IconCurrencyEuro, IconClock, IconSearch, IconX, IconChevronRight,
  IconUserPlus, IconReceiptEuro,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const {
    testeingabe, kundenabrechnung,
    testeingabeMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedKundenabrechnung = enrichKundenabrechnung(kundenabrechnung, { testeingabeMap });

  // All hooks before early returns
  const [selectedKunde, setSelectedKunde] = useState<Testeingabe | null>(null);
  const [kundeSearch, setKundeSearch] = useState('');
  const [kundeDialogOpen, setKundeDialogOpen] = useState(false);
  const [editKunde, setEditKunde] = useState<Testeingabe | null>(null);
  const [deleteKunde, setDeleteKunde] = useState<Testeingabe | null>(null);
  const [rechnungDialogOpen, setRechnungDialogOpen] = useState(false);
  const [editRechnung, setEditRechnung] = useState<EnrichedKundenabrechnung | null>(null);
  const [deleteRechnung, setDeleteRechnung] = useState<EnrichedKundenabrechnung | null>(null);

  const filteredKunden = useMemo(() => {
    const q = kundeSearch.toLowerCase();
    return testeingabe.filter(k => {
      if (!q) return true;
      return (
        (k.fields.vorname ?? '').toLowerCase().includes(q) ||
        (k.fields.nachname ?? '').toLowerCase().includes(q) ||
        (k.fields.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [testeingabe, kundeSearch]);

  const rechnungenForSelected = useMemo(() => {
    if (!selectedKunde) return [];
    return enrichedKundenabrechnung.filter(r => {
      const id = extractRecordId(r.fields.kunde_ref);
      return id === selectedKunde.record_id;
    });
  }, [enrichedKundenabrechnung, selectedKunde]);

  const totalUmsatz = useMemo(() =>
    enrichedKundenabrechnung.reduce((sum, r) => sum + (r.fields.gesamtbetrag ?? 0), 0),
    [enrichedKundenabrechnung]
  );

  const ueberfaellig = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return enrichedKundenabrechnung.filter(r => r.fields.faelligkeit && r.fields.faelligkeit < today).length;
  }, [enrichedKundenabrechnung]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const kundeDisplayName = (k: Testeingabe) =>
    [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || '(Kein Name)';

  const getKundeUmsatz = (kundeId: string) =>
    enrichedKundenabrechnung
      .filter(r => extractRecordId(r.fields.kunde_ref) === kundeId)
      .reduce((sum, r) => sum + (r.fields.gesamtbetrag ?? 0), 0);

  const getKundeRechnungCount = (kundeId: string) =>
    enrichedKundenabrechnung.filter(r => extractRecordId(r.fields.kunde_ref) === kundeId).length;

  const zahlungsartOpts = LOOKUP_OPTIONS.kundenabrechnung?.zahlungsart ?? [];
  const zahlungsartLabel = (r: Kundenabrechnung) =>
    zahlungsartOpts.find(o => o.key === r.fields.zahlungsart?.key)?.label ?? r.fields.zahlungsart?.label ?? '—';

  const isOverdue = (r: Kundenabrechnung) => {
    const today = new Date().toISOString().slice(0, 10);
    return !!(r.fields.faelligkeit && r.fields.faelligkeit < today);
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Kunden"
          value={String(testeingabe.length)}
          description="Gesamt"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Rechnungen"
          value={String(kundenabrechnung.length)}
          description="Gesamt"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Umsatz"
          value={formatCurrency(totalUmsatz)}
          description="Gesamtbetrag"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Überfällig"
          value={String(ueberfaellig)}
          description="Rechnungen"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[520px]">
        {/* Left: Kundenliste */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border gap-2">
            <h2 className="font-semibold text-base text-foreground">Kunden</h2>
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => { setEditKunde(null); setKundeDialogOpen(true); }}
            >
              <IconPlus size={14} />
              <span className="hidden sm:inline">Neu</span>
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Kunden suchen…"
                value={kundeSearch}
                onChange={e => setKundeSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {kundeSearch && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setKundeSearch('')}
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredKunden.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <IconUserPlus size={32} stroke={1.5} />
                <p className="text-sm">Noch keine Kunden</p>
              </div>
            ) : (
              filteredKunden.map(k => {
                const isSelected = selectedKunde?.record_id === k.record_id;
                const count = getKundeRechnungCount(k.record_id);
                const umsatz = getKundeUmsatz(k.record_id);
                return (
                  <button
                    key={k.record_id}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'bg-primary/8 border-l-2 border-l-primary'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedKunde(isSelected ? null : k)}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {(k.fields.vorname?.[0] ?? k.fields.nachname?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground truncate">{kundeDisplayName(k)}</div>
                      <div className="text-xs text-muted-foreground truncate">{k.fields.email ?? k.fields.telefon ?? '—'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{count} Rechnung{count !== 1 ? 'en' : ''}</span>
                        {umsatz > 0 && <span className="text-xs font-medium text-primary">{formatCurrency(umsatz)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Bearbeiten"
                        onClick={e => { e.stopPropagation(); setEditKunde(k); setKundeDialogOpen(true); }}
                      >
                        <IconPencil size={13} />
                      </button>
                      <button
                        className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Löschen"
                        onClick={e => { e.stopPropagation(); setDeleteKunde(k); }}
                      >
                        <IconTrash size={13} />
                      </button>
                      <IconChevronRight size={13} className={`text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Rechnungen */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          {selectedKunde ? (
            <>
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border gap-2 flex-wrap">
                <div className="min-w-0">
                  <h2 className="font-semibold text-base text-foreground truncate">
                    Rechnungen — {kundeDisplayName(selectedKunde)}
                  </h2>
                  <p className="text-xs text-muted-foreground">{rechnungenForSelected.length} Einträge</p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => { setEditRechnung(null); setRechnungDialogOpen(true); }}
                >
                  <IconPlus size={14} />
                  <span>Neue Rechnung</span>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {rechnungenForSelected.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <IconReceiptEuro size={40} stroke={1.5} />
                    <div className="text-center">
                      <p className="text-sm font-medium">Noch keine Rechnungen</p>
                      <p className="text-xs">Erstellen Sie die erste Rechnung für diesen Kunden.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 mt-1"
                      onClick={() => { setEditRechnung(null); setRechnungDialogOpen(true); }}
                    >
                      <IconPlus size={14} />
                      Rechnung erstellen
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Rechnungsnr.</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Leistung</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Betrag</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Zahlungsart</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Fälligkeit</th>
                          <th className="px-3 py-2.5 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rechnungenForSelected.map(r => (
                          <tr key={r.record_id} className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                              {r.fields.rechnungsnummer ?? '—'}
                            </td>
                            <td className="px-3 py-3 min-w-0">
                              <div className="truncate max-w-[180px]">{r.fields.leistungsbeschreibung ?? '—'}</div>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                              {formatCurrency(r.fields.gesamtbetrag)}
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell text-muted-foreground">
                              {zahlungsartLabel(r)}
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              {r.fields.faelligkeit ? (
                                <span className={isOverdue(r) ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                  {formatDate(r.fields.faelligkeit)}
                                  {isOverdue(r) && (
                                    <Badge variant="destructive" className="ml-1.5 text-[10px] py-0 px-1">Überfällig</Badge>
                                  )}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                  title="Bearbeiten"
                                  onClick={() => { setEditRechnung(r); setRechnungDialogOpen(true); }}
                                >
                                  <IconPencil size={14} />
                                </button>
                                <button
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Löschen"
                                  onClick={() => setDeleteRechnung(r)}
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer summary */}
              {rechnungenForSelected.length > 0 && (
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">
                    {rechnungenForSelected.length} Rechnung{rechnungenForSelected.length !== 1 ? 'en' : ''}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    Gesamt: {formatCurrency(rechnungenForSelected.reduce((s, r) => s + (r.fields.gesamtbetrag ?? 0), 0))}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <IconUsers size={48} stroke={1.5} />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Kunden wählen</p>
                <p className="text-xs">Wählen Sie links einen Kunden aus, um dessen Rechnungen zu sehen.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TesteingabeDialog
        open={kundeDialogOpen}
        onClose={() => { setKundeDialogOpen(false); setEditKunde(null); }}
        onSubmit={async (fields) => {
          if (editKunde) {
            await LivingAppsService.updateTesteingabeEntry(editKunde.record_id, fields);
          } else {
            await LivingAppsService.createTesteingabeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editKunde?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Testeingabe']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Testeingabe']}
      />

      <KundenabrechnungDialog
        open={rechnungDialogOpen}
        onClose={() => { setRechnungDialogOpen(false); setEditRechnung(null); }}
        onSubmit={async (fields) => {
          if (editRechnung) {
            await LivingAppsService.updateKundenabrechnungEntry(editRechnung.record_id, fields);
          } else {
            const kundeUrl = selectedKunde
              ? createRecordUrl(APP_IDS.TESTEINGABE, selectedKunde.record_id)
              : undefined;
            await LivingAppsService.createKundenabrechnungEntry({ ...fields, kunde_ref: kundeUrl });
          }
          fetchAll();
        }}
        defaultValues={editRechnung
          ? editRechnung.fields
          : selectedKunde
            ? { kunde_ref: createRecordUrl(APP_IDS.TESTEINGABE, selectedKunde.record_id) }
            : undefined
        }
        testeingabeList={testeingabe}
        enablePhotoScan={AI_PHOTO_SCAN['Kundenabrechnung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kundenabrechnung']}
      />

      <ConfirmDialog
        open={!!deleteKunde}
        title="Kunden löschen"
        description={`Möchten Sie den Kunden „${deleteKunde ? kundeDisplayName(deleteKunde) : ''}" wirklich löschen?`}
        onConfirm={async () => {
          if (!deleteKunde) return;
          await LivingAppsService.deleteTesteingabeEntry(deleteKunde.record_id);
          if (selectedKunde?.record_id === deleteKunde.record_id) setSelectedKunde(null);
          setDeleteKunde(null);
          fetchAll();
        }}
        onClose={() => setDeleteKunde(null)}
      />

      <ConfirmDialog
        open={!!deleteRechnung}
        title="Rechnung löschen"
        description={`Möchten Sie die Rechnung ${deleteRechnung?.fields.rechnungsnummer ? `„${deleteRechnung.fields.rechnungsnummer}"` : ''} wirklich löschen?`}
        onConfirm={async () => {
          if (!deleteRechnung) return;
          await LivingAppsService.deleteKundenabrechnungEntry(deleteRechnung.record_id);
          setDeleteRechnung(null);
          fetchAll();
        }}
        onClose={() => setDeleteRechnung(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
    </div>
  );
}
