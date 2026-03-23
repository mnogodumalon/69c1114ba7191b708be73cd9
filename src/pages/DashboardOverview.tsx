import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichKundenabrechnung } from '@/lib/enrich';
import type { EnrichedKundenabrechnung } from '@/types/enriched';
import type { Testeingabe } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { KundenabrechnungDialog } from '@/components/dialogs/KundenabrechnungDialog';
import { TesteingabeDialog } from '@/components/dialogs/TesteingabeDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  IconAlertCircle, IconPlus, IconPencil, IconTrash,
  IconUsers, IconFileText, IconCurrencyEuro, IconSearch,
  IconUser, IconMail, IconPhone, IconChevronRight,
} from '@tabler/icons-react';

type DialogMode =
  | { type: 'create-invoice'; kunde: Testeingabe }
  | { type: 'edit-invoice'; record: EnrichedKundenabrechnung }
  | { type: 'create-customer' }
  | { type: 'edit-customer'; record: Testeingabe }
  | null;

export default function DashboardOverview() {
  const {
    kundenabrechnung, testeingabe,
    testeingabeMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedKundenabrechnung = enrichKundenabrechnung(kundenabrechnung, { testeingabeMap });

  const [selectedKunde, setSelectedKunde] = useState<Testeingabe | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'invoice' | 'customer'; id: string } | null>(null);

  const filteredKunden = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return testeingabe.filter(k => {
      const name = `${k.fields.vorname ?? ''} ${k.fields.nachname ?? ''}`.toLowerCase();
      const email = (k.fields.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [testeingabe, customerSearch]);

  const selectedInvoices = useMemo(() => {
    if (!selectedKunde) return [];
    return enrichedKundenabrechnung.filter(inv => {
      const id = inv.fields.kunde_ref?.split('/').pop();
      return id === selectedKunde.record_id;
    });
  }, [selectedKunde, enrichedKundenabrechnung]);

  const totalRevenue = useMemo(() =>
    kundenabrechnung.reduce((sum, inv) => sum + (inv.fields.gesamtbetrag ?? 0), 0),
    [kundenabrechnung]
  );

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return kundenabrechnung.filter(inv => inv.fields.faelligkeit && inv.fields.faelligkeit < today).length;
  }, [kundenabrechnung]);

  const handleDeleteInvoice = async () => {
    if (!deleteTarget || deleteTarget.type !== 'invoice') return;
    await LivingAppsService.deleteKundenabrechnungEntry(deleteTarget.id);
    if (selectedKunde && selectedInvoices.length === 1) setSelectedKunde(null);
    setDeleteTarget(null);
    fetchAll();
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget || deleteTarget.type !== 'customer') return;
    await LivingAppsService.deleteTesteingabeEntry(deleteTarget.id);
    if (selectedKunde?.record_id === deleteTarget.id) setSelectedKunde(null);
    setDeleteTarget(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const totalInvoices = kundenabrechnung.length;
  const totalCustomers = testeingabe.length;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Kunden"
          value={String(totalCustomers)}
          description="Gesamt"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Rechnungen"
          value={String(totalInvoices)}
          description="Gesamt"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtumsatz"
          value={formatCurrency(totalRevenue)}
          description="Alle Rechnungen"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Überfällig"
          value={String(overdueCount)}
          description="Rechnungen"
          icon={<IconAlertCircle size={18} className={overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'} />}
        />
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[520px]">
        {/* Left: Customer List */}
        <div className="lg:col-span-2 flex flex-col bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-semibold text-base text-foreground">Kunden</h2>
            <Button
              size="sm"
              onClick={() => setDialogMode({ type: 'create-customer' })}
              className="gap-1 shrink-0"
            >
              <IconPlus size={15} className="shrink-0" />
              <span className="hidden sm:inline">Neu</span>
            </Button>
          </div>

          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Kunden suchen..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredKunden.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <IconUsers size={36} stroke={1.5} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {customerSearch ? 'Keine Kunden gefunden.' : 'Noch keine Kunden angelegt.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredKunden.map(kunde => {
                  const name = [kunde.fields.vorname, kunde.fields.nachname].filter(Boolean).join(' ') || 'Unbekannt';
                  const invoiceCount = enrichedKundenabrechnung.filter(inv => {
                    const id = inv.fields.kunde_ref?.split('/').pop();
                    return id === kunde.record_id;
                  }).length;
                  const isSelected = selectedKunde?.record_id === kunde.record_id;

                  return (
                    <li key={kunde.record_id}>
                      <button
                        onClick={() => setSelectedKunde(isSelected ? null : kunde)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-accent/60'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {(kunde.fields.vorname?.[0] ?? kunde.fields.nachname?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{name}</p>
                          {kunde.fields.email && (
                            <p className="text-xs text-muted-foreground truncate">{kunde.fields.email}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {invoiceCount > 0 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                              {invoiceCount}
                            </Badge>
                          )}
                          <div className="flex gap-0.5">
                            <button
                              onClick={e => { e.stopPropagation(); setDialogMode({ type: 'edit-customer', record: kunde }); }}
                              className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title="Bearbeiten"
                            >
                              <IconPencil size={13} className="shrink-0" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'customer', id: kunde.record_id }); }}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Löschen"
                            >
                              <IconTrash size={13} className="shrink-0" />
                            </button>
                          </div>
                          <IconChevronRight size={14} className={`shrink-0 transition-transform ${isSelected ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Invoice Detail */}
        <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-2xl overflow-hidden">
          {!selectedKunde ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <IconUser size={28} stroke={1.5} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Kunde auswählen</p>
                <p className="text-sm text-muted-foreground mt-1">Klicke auf einen Kunden, um seine Rechnungen zu sehen.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Customer Header */}
              <div className="px-5 pt-4 pb-3 border-b border-border">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-base text-foreground truncate">
                      {[selectedKunde.fields.vorname, selectedKunde.fields.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      {selectedKunde.fields.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <IconMail size={12} className="shrink-0" />
                          <span className="truncate">{selectedKunde.fields.email}</span>
                        </span>
                      )}
                      {selectedKunde.fields.telefon && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <IconPhone size={12} className="shrink-0" />
                          <span>{selectedKunde.fields.telefon}</span>
                        </span>
                      )}
                      {selectedKunde.fields.geburtsdatum && (
                        <span className="text-xs text-muted-foreground">
                          Geb.: {formatDate(selectedKunde.fields.geburtsdatum)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setDialogMode({ type: 'create-invoice', kunde: selectedKunde })}
                    className="gap-1 shrink-0"
                  >
                    <IconPlus size={15} className="shrink-0" />
                    Rechnung
                  </Button>
                </div>
              </div>

              {/* Invoices */}
              <div className="flex-1 overflow-y-auto">
                {selectedInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                    <IconFileText size={36} stroke={1.5} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Noch keine Rechnungen für diesen Kunden.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogMode({ type: 'create-invoice', kunde: selectedKunde })}
                      className="mt-1"
                    >
                      <IconPlus size={14} className="mr-1" />
                      Erste Rechnung erstellen
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedInvoices.map(inv => {
                      const today = new Date().toISOString().slice(0, 10);
                      const isOverdue = inv.fields.faelligkeit && inv.fields.faelligkeit < today;

                      return (
                        <div key={inv.record_id} className="px-5 py-4 flex items-start justify-between gap-3 hover:bg-accent/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {inv.fields.rechnungsnummer && (
                                <span className="font-medium text-sm text-foreground">
                                  #{inv.fields.rechnungsnummer}
                                </span>
                              )}
                              {inv.fields.zahlungsart && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto">
                                  {inv.fields.zahlungsart.label}
                                </Badge>
                              )}
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0.5 h-auto">
                                  Überfällig
                                </Badge>
                              )}
                            </div>
                            {inv.fields.leistungsbeschreibung && (
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                {inv.fields.leistungsbeschreibung}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                              {inv.fields.faelligkeit && (
                                <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  Fällig: {formatDate(inv.fields.faelligkeit)}
                                </span>
                              )}
                              {inv.fields.menge != null && inv.fields.einzelpreis != null && (
                                <span className="text-xs text-muted-foreground">
                                  {inv.fields.menge} × {formatCurrency(inv.fields.einzelpreis)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {inv.fields.gesamtbetrag != null && (
                              <span className="font-semibold text-base text-foreground whitespace-nowrap">
                                {formatCurrency(inv.fields.gesamtbetrag)}
                              </span>
                            )}
                            <div className="flex gap-1">
                              <button
                                onClick={() => setDialogMode({ type: 'edit-invoice', record: inv })}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title="Bearbeiten"
                              >
                                <IconPencil size={14} className="shrink-0" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: 'invoice', id: inv.record_id })}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Löschen"
                              >
                                <IconTrash size={14} className="shrink-0" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Customer invoice summary */}
                    <div className="px-5 py-3 bg-muted/40 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedInvoices.length} {selectedInvoices.length === 1 ? 'Rechnung' : 'Rechnungen'}
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        Gesamt: {formatCurrency(selectedInvoices.reduce((s, inv) => s + (inv.fields.gesamtbetrag ?? 0), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {(dialogMode?.type === 'create-invoice' || dialogMode?.type === 'edit-invoice') && (
        <KundenabrechnungDialog
          open
          onClose={() => setDialogMode(null)}
          onSubmit={async fields => {
            if (dialogMode.type === 'edit-invoice') {
              await LivingAppsService.updateKundenabrechnungEntry(dialogMode.record.record_id, fields);
            } else {
              await LivingAppsService.createKundenabrechnungEntry(fields);
            }
            fetchAll();
          }}
          defaultValues={
            dialogMode.type === 'edit-invoice'
              ? dialogMode.record.fields
              : dialogMode.type === 'create-invoice'
              ? { kunde_ref: createRecordUrl(APP_IDS.TESTEINGABE, dialogMode.kunde.record_id) }
              : undefined
          }
          testeingabeList={testeingabe}
          enablePhotoScan={AI_PHOTO_SCAN['Kundenabrechnung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Kundenabrechnung']}
        />
      )}

      {(dialogMode?.type === 'create-customer' || dialogMode?.type === 'edit-customer') && (
        <TesteingabeDialog
          open
          onClose={() => setDialogMode(null)}
          onSubmit={async fields => {
            if (dialogMode.type === 'edit-customer') {
              await LivingAppsService.updateTesteingabeEntry(dialogMode.record.record_id, fields);
            } else {
              await LivingAppsService.createTesteingabeEntry(fields);
            }
            fetchAll();
          }}
          defaultValues={dialogMode.type === 'edit-customer' ? dialogMode.record.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Testeingabe']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Testeingabe']}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'customer' ? 'Kunden löschen' : 'Rechnung löschen'}
        description={
          deleteTarget?.type === 'customer'
            ? 'Soll dieser Kunde wirklich gelöscht werden?'
            : 'Soll diese Rechnung wirklich gelöscht werden?'
        }
        onConfirm={deleteTarget?.type === 'customer' ? handleDeleteCustomer : handleDeleteInvoice}
        onClose={() => setDeleteTarget(null)}
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
        <Skeleton className="lg:col-span-3 h-96 rounded-2xl" />
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
