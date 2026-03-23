import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichKundenabrechnung } from '@/lib/enrich';
import type { EnrichedKundenabrechnung } from '@/types/enriched';
import type { Testeingabe } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TesteingabeDialog } from '@/components/dialogs/TesteingabeDialog';
import { KundenabrechnungDialog } from '@/components/dialogs/KundenabrechnungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconUser,
  IconFileInvoice,
  IconCurrencyEuro,
  IconUsers,
  IconCalendar,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const {
    testeingabe, kundenabrechnung,
    testeingabeMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedKundenabrechnung = enrichKundenabrechnung(kundenabrechnung, { testeingabeMap });

  // State
  const [selectedCustomer, setSelectedCustomer] = useState<Testeingabe | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Dialog states
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Testeingabe | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Testeingabe | null>(null);

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<EnrichedKundenabrechnung | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<EnrichedKundenabrechnung | null>(null);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return testeingabe.filter(c =>
      !q ||
      (c.fields.vorname ?? '').toLowerCase().includes(q) ||
      (c.fields.nachname ?? '').toLowerCase().includes(q) ||
      (c.fields.email ?? '').toLowerCase().includes(q)
    );
  }, [testeingabe, customerSearch]);

  // Invoices for selected customer
  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    const q = invoiceSearch.toLowerCase();
    return enrichedKundenabrechnung.filter(inv => {
      const matchesCustomer = inv.kunde_refName === `${selectedCustomer.fields.vorname ?? ''} ${selectedCustomer.fields.nachname ?? ''}`.trim() ||
        inv.fields.kunde_ref?.includes(selectedCustomer.record_id);
      if (!matchesCustomer) return false;
      if (!q) return true;
      return (
        (inv.fields.rechnungsnummer ?? '').toLowerCase().includes(q) ||
        (inv.fields.leistungsbeschreibung ?? '').toLowerCase().includes(q)
      );
    });
  }, [enrichedKundenabrechnung, selectedCustomer, invoiceSearch]);

  // KPIs
  const totalRevenue = useMemo(() =>
    enrichedKundenabrechnung.reduce((sum, inv) => sum + (inv.fields.gesamtbetrag ?? 0), 0),
    [enrichedKundenabrechnung]
  );

  const customerRevenue = useMemo(() =>
    customerInvoices.reduce((sum, inv) => sum + (inv.fields.gesamtbetrag ?? 0), 0),
    [customerInvoices]
  );

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return enrichedKundenabrechnung.filter(inv => inv.fields.faelligkeit && inv.fields.faelligkeit < today).length;
  }, [enrichedKundenabrechnung]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleDeleteCustomer = async () => {
    if (!deleteCustomer) return;
    await LivingAppsService.deleteTesteingabeEntry(deleteCustomer.record_id);
    if (selectedCustomer?.record_id === deleteCustomer.record_id) setSelectedCustomer(null);
    setDeleteCustomer(null);
    fetchAll();
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoice) return;
    await LivingAppsService.deleteKundenabrechnungEntry(deleteInvoice.record_id);
    setDeleteInvoice(null);
    fetchAll();
  };

  return (
    <div className="space-y-5">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <IconUsers size={16} className="text-primary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Kunden</span>
          </div>
          <div className="text-2xl font-700 text-foreground">{testeingabe.length}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <IconFileInvoice size={16} className="text-primary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Rechnungen</span>
          </div>
          <div className="text-2xl font-700 text-foreground">{enrichedKundenabrechnung.length}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <IconCurrencyEuro size={16} className="text-primary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Gesamtumsatz</span>
          </div>
          <div className="text-2xl font-700 text-foreground truncate">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <IconCalendar size={16} className="text-destructive shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Überfällig</span>
          </div>
          <div className="text-2xl font-700 text-foreground">{overdueCount}</div>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Customer List (Master) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Kunden</h2>
              <Button
                size="sm"
                onClick={() => { setEditCustomer(null); setCustomerDialogOpen(true); }}
                className="shrink-0"
              >
                <IconPlus size={14} className="shrink-0" />
                <span className="hidden sm:inline ml-1">Neu</span>
              </Button>
            </div>
            <div className="relative">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Kunden suchen..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 max-h-[480px] lg:max-h-none">
            {filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <IconUser size={36} className="text-muted-foreground" stroke={1.5} />
                <p className="text-sm text-muted-foreground">Keine Kunden gefunden</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredCustomers.map(customer => {
                  const isSelected = selectedCustomer?.record_id === customer.record_id;
                  const invoiceCount = enrichedKundenabrechnung.filter(inv =>
                    inv.fields.kunde_ref?.includes(customer.record_id)
                  ).length;
                  const fullName = [customer.fields.vorname, customer.fields.nachname].filter(Boolean).join(' ') || '(Kein Name)';
                  return (
                    <li key={customer.record_id}>
                      <button
                        onClick={() => setSelectedCustomer(isSelected ? null : customer)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-l-2 border-primary'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-foreground truncate">{fullName}</div>
                            {customer.fields.email && (
                              <div className="text-xs text-muted-foreground truncate">{customer.fields.email}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {invoiceCount > 0 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                {invoiceCount}
                              </Badge>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setEditCustomer(customer); setCustomerDialogOpen(true); }}
                              className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              title="Bearbeiten"
                            >
                              <IconPencil size={13} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteCustomer(customer); }}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Löschen"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Invoice Detail (Detail) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          {!selectedCustomer ? (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
              <IconFileInvoice size={48} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Wählen Sie einen Kunden aus, um seine Rechnungen anzuzeigen
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground truncate">
                      {[selectedCustomer.fields.vorname, selectedCustomer.fields.nachname].filter(Boolean).join(' ') || '(Kein Name)'}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {selectedCustomer.fields.email && (
                        <span className="text-xs text-muted-foreground truncate">{selectedCustomer.fields.email}</span>
                      )}
                      {selectedCustomer.fields.telefon && (
                        <span className="text-xs text-muted-foreground">{selectedCustomer.fields.telefon}</span>
                      )}
                      {selectedCustomer.fields.geburtsdatum && (
                        <span className="text-xs text-muted-foreground">geb. {formatDate(selectedCustomer.fields.geburtsdatum)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {customerRevenue > 0 && (
                      <span className="text-sm font-semibold text-primary">{formatCurrency(customerRevenue)}</span>
                    )}
                    <Button
                      size="sm"
                      onClick={() => { setEditInvoice(null); setInvoiceDialogOpen(true); }}
                    >
                      <IconPlus size={14} className="shrink-0" />
                      <span className="ml-1">Rechnung</span>
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Rechnungen suchen..."
                    value={invoiceSearch}
                    onChange={e => setInvoiceSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>

              <div className="overflow-y-auto flex-1 max-h-[400px] lg:max-h-none">
                {customerInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <IconFileInvoice size={36} className="text-muted-foreground" stroke={1.5} />
                    <p className="text-sm text-muted-foreground">Keine Rechnungen vorhanden</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditInvoice(null); setInvoiceDialogOpen(true); }}
                    >
                      <IconPlus size={14} className="mr-1 shrink-0" />
                      Erste Rechnung anlegen
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nr.</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Leistung</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Betrag</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Zahlungsart</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Fälligkeit</th>
                          <th className="px-4 py-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customerInvoices.map(inv => {
                          const today = new Date().toISOString().slice(0, 10);
                          const isOverdue = inv.fields.faelligkeit && inv.fields.faelligkeit < today;
                          return (
                            <tr key={inv.record_id} className="hover:bg-accent/30 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs text-muted-foreground truncate max-w-[80px] block">
                                  {inv.fields.rechnungsnummer ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-[180px]">
                                <span className="truncate block text-foreground">
                                  {inv.fields.leistungsbeschreibung ?? '—'}
                                </span>
                                {inv.fields.menge != null && inv.fields.einzelpreis != null && (
                                  <span className="text-xs text-muted-foreground">
                                    {inv.fields.menge} × {formatCurrency(inv.fields.einzelpreis)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell">
                                <span className="font-semibold text-foreground whitespace-nowrap">
                                  {inv.fields.gesamtbetrag != null ? formatCurrency(inv.fields.gesamtbetrag) : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                {inv.fields.zahlungsart ? (
                                  <Badge variant="outline" className="text-xs">
                                    {inv.fields.zahlungsart.label}
                                  </Badge>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                {inv.fields.faelligkeit ? (
                                  <span className={`text-xs whitespace-nowrap ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                    {formatDate(inv.fields.faelligkeit)}
                                    {isOverdue && ' ⚠'}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    onClick={() => { setEditInvoice(inv); setInvoiceDialogOpen(true); }}
                                    className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                    title="Bearbeiten"
                                  >
                                    <IconPencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteInvoice(inv)}
                                    className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Löschen"
                                  >
                                    <IconTrash size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TesteingabeDialog
        open={customerDialogOpen}
        onClose={() => { setCustomerDialogOpen(false); setEditCustomer(null); }}
        onSubmit={async (fields) => {
          if (editCustomer) {
            await LivingAppsService.updateTesteingabeEntry(editCustomer.record_id, fields);
          } else {
            await LivingAppsService.createTesteingabeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editCustomer?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Testeingabe']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Testeingabe']}
      />

      <KundenabrechnungDialog
        open={invoiceDialogOpen}
        onClose={() => { setInvoiceDialogOpen(false); setEditInvoice(null); }}
        onSubmit={async (fields) => {
          if (editInvoice) {
            await LivingAppsService.updateKundenabrechnungEntry(editInvoice.record_id, fields);
          } else {
            const defaultedFields = {
              ...fields,
              kunde_ref: fields.kunde_ref ?? (selectedCustomer
                ? createRecordUrl(APP_IDS.TESTEINGABE, selectedCustomer.record_id)
                : undefined),
            };
            await LivingAppsService.createKundenabrechnungEntry(defaultedFields);
          }
          fetchAll();
        }}
        defaultValues={
          editInvoice
            ? editInvoice.fields
            : selectedCustomer
            ? { kunde_ref: createRecordUrl(APP_IDS.TESTEINGABE, selectedCustomer.record_id) }
            : undefined
        }
        testeingabeList={testeingabe}
        enablePhotoScan={AI_PHOTO_SCAN['Kundenabrechnung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kundenabrechnung']}
      />

      <ConfirmDialog
        open={!!deleteCustomer}
        title="Kunde löschen"
        description={`${[deleteCustomer?.fields.vorname, deleteCustomer?.fields.nachname].filter(Boolean).join(' ')} wirklich löschen?`}
        onConfirm={handleDeleteCustomer}
        onClose={() => setDeleteCustomer(null)}
      />

      <ConfirmDialog
        open={!!deleteInvoice}
        title="Rechnung löschen"
        description={`Rechnung ${deleteInvoice?.fields.rechnungsnummer ?? ''} wirklich löschen?`}
        onConfirm={handleDeleteInvoice}
        onClose={() => setDeleteInvoice(null)}
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
