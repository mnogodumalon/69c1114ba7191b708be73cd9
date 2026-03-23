import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Testeingabe } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { TesteingabeDialog } from '@/components/dialogs/TesteingabeDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  IconAlertCircle,
  IconPlus,
  IconSearch,
  IconPencil,
  IconTrash,
  IconUser,
  IconMail,
  IconPhone,
  IconCalendar,
  IconNotes,
  IconUsers,
  IconUserPlus,
  IconUsersGroup,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const { testeingabe, loading, error, fetchAll } = useDashboardData();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Testeingabe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Testeingabe | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return testeingabe;
    return testeingabe.filter(r => {
      const { vorname, nachname, email, telefon, bemerkungen } = r.fields;
      return (
        (vorname ?? '').toLowerCase().includes(q) ||
        (nachname ?? '').toLowerCase().includes(q) ||
        (email ?? '').toLowerCase().includes(q) ||
        (telefon ?? '').toLowerCase().includes(q) ||
        (bemerkungen ?? '').toLowerCase().includes(q)
      );
    });
  }, [testeingabe, search]);

  const withEmail = useMemo(() => testeingabe.filter(r => r.fields.email).length, [testeingabe]);
  const withPhone = useMemo(() => testeingabe.filter(r => r.fields.telefon).length, [testeingabe]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteTesteingabeEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Einträge gesamt"
          value={String(testeingabe.length)}
          description="Alle Personen"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Mit E-Mail"
          value={String(withEmail)}
          description="Erreichbar per Mail"
          icon={<IconMail size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Mit Telefon"
          value={String(withPhone)}
          description="Erreichbar per Telefon"
          icon={<IconPhone size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Header + Search + Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Kontakte</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'Person' : 'Personen'}{search ? ' gefunden' : ' insgesamt'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => { setEditRecord(null); setDialogOpen(true); }}
          >
            <IconPlus size={15} className="shrink-0 mr-1" />
            <span className="hidden sm:inline">Hinzufügen</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        </div>
      </div>

      {/* Contact Cards Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <IconUsersGroup size={32} stroke={1.5} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">
              {search ? 'Keine Treffer' : 'Noch keine Einträge'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search
                ? 'Versuche einen anderen Suchbegriff.'
                : 'Füge deine erste Person hinzu.'}
            </p>
          </div>
          {!search && (
            <Button onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
              <IconUserPlus size={15} className="mr-2 shrink-0" />
              Ersten Eintrag anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(record => (
            <ContactCard
              key={record.record_id}
              record={record}
              onEdit={() => { setEditRecord(record); setDialogOpen(true); }}
              onDelete={() => setDeleteTarget(record)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <TesteingabeDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateTesteingabeEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createTesteingabeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Testeingabe']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Testeingabe']}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description={`Möchtest du „${[deleteTarget?.fields.vorname, deleteTarget?.fields.nachname].filter(Boolean).join(' ') || 'diesen Eintrag'}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ContactCard({
  record,
  onEdit,
  onDelete,
}: {
  record: Testeingabe;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { vorname, nachname, email, telefon, geburtsdatum, bemerkungen } = record.fields;
  const fullName = [vorname, nachname].filter(Boolean).join(' ') || '(Kein Name)';
  const initials = [vorname?.[0], nachname?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <div className="bg-card rounded-[20px] shadow-sm border border-border overflow-hidden flex flex-col">
      {/* Card Header */}
      <div className="bg-primary/5 px-5 pt-5 pb-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-base font-bold text-primary">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-base truncate">{fullName}</h3>
          {email && (
            <a
              href={`mailto:${email}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block mt-0.5"
            >
              {email}
            </a>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 flex-1 space-y-2">
        {telefon && (
          <div className="flex items-center gap-2 min-w-0">
            <IconPhone size={14} className="text-muted-foreground shrink-0" />
            <a
              href={`tel:${telefon}`}
              className="text-sm text-foreground hover:text-primary transition-colors truncate"
            >
              {telefon}
            </a>
          </div>
        )}
        {geburtsdatum && (
          <div className="flex items-center gap-2 min-w-0">
            <IconCalendar size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{formatDate(geburtsdatum)}</span>
          </div>
        )}
        {!telefon && !geburtsdatum && !bemerkungen && (
          <div className="flex items-center gap-2 min-w-0">
            <IconUser size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground italic">Keine weiteren Angaben</span>
          </div>
        )}
        {bemerkungen && (
          <div className="flex items-start gap-2 min-w-0">
            <IconNotes size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground line-clamp-2 min-w-0">{bemerkungen}</p>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-4 pb-4 flex gap-2 justify-end border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <IconPencil size={14} className="shrink-0 mr-1" />
          Bearbeiten
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <IconTrash size={14} className="shrink-0 mr-1" />
          Löschen
        </Button>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[20px]" />)}
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
