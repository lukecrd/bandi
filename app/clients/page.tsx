"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileUp,
  Columns3,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Client, ClientInput } from "@/lib/types";

type ClientColumn =
  | "ragione_sociale"
  | "regione"
  | "citta"
  | "codici_ateco"
  | "settore"
  | "partita_iva"
  | "taglia_aziendale"
  | "requisiti"
  | "note";

const clientColumns: { key: ClientColumn; label: string }[] = [
  { key: "ragione_sociale", label: "Nome" },
  { key: "regione", label: "Regione" },
  { key: "citta", label: "Città" },
  { key: "codici_ateco", label: "Codici ATECO" },
  { key: "settore", label: "Settore" },
  { key: "partita_iva", label: "Partita IVA" },
  { key: "taglia_aziendale", label: "Taglia aziendale" },
  { key: "requisiti", label: "Requisiti" },
  { key: "note", label: "Note" },
];

const defaultVisibleColumns: ClientColumn[] = [
  "ragione_sociale",
  "regione",
  "citta",
  "codici_ateco",
  "settore",
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ClientColumn[]>(defaultVisibleColumns);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [formData, setFormData] = useState<ClientInput>({
    ragione_sociale: "",
    partita_iva: "",
    citta: "",
    codici_ateco: "",
    settore: "",
    regione: "",
    taglia_aziendale: "",
    requisiti: "",
    note: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClients(data.clients);
      setIsLoading(false);
    };
    load();
  }, []);

  const sectors = ["", ...Array.from(new Set(clients.map((c) => c.settore)))];
  const regions = ["", ...Array.from(new Set(clients.map((c) => c.regione)))];

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      !searchTerm ||
      client.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.partita_iva.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = !filterSector || client.settore === filterSector;
    const matchesRegion = !filterRegion || client.regione === filterRegion;
    return matchesSearch && matchesSector && matchesRegion;
  });
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleColumn = (column: ClientColumn) => {
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((key) => key !== column)
        : clientColumns.filter(({ key }) => current.includes(key) || key === column).map(({ key }) => key)
    );
  };

  const openCreateDialog = () => {
    setEditingClient(null);
    setFormData({
      ragione_sociale: "",
      partita_iva: "",
      citta: "",
      codici_ateco: "",
      settore: "",
      regione: "",
      taglia_aziendale: "",
      requisiti: "",
      note: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormData({
      ragione_sociale: client.ragione_sociale,
      partita_iva: client.partita_iva,
      citta: client.citta,
      codici_ateco: client.codici_ateco,
      settore: client.settore,
      regione: client.regione,
      taglia_aziendale: client.taglia_aziendale,
      requisiti: client.requisiti,
      note: client.note,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (client: Client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingClient
      ? `/api/clients/${editingClient.id}`
      : "/api/clients";
    const method = editingClient ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setIsDialogOpen(false);
      const res2 = await fetch("/api/clients");
      const data = await res2.json();
      setClients(data.clients);
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    await fetch(`/api/clients/${clientToDelete.id}`, { method: "DELETE" });
    setIsDeleteDialogOpen(false);
    setClients(clients.filter((c) => c.id !== clientToDelete.id));
  };

  const handleExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportMessage(null);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossibile importare il file");
      }

      if (data.clients?.length) {
        setClients((prev) => [...data.clients, ...prev]);
      }
      const errors = data.errors || [];
      const skipped = errors.length
        ? ` ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? `; e altre ${errors.length - 3} righe` : ""}`
        : "";
      setImportMessage(`Importati ${data.imported} clienti.${skipped}`);
    } catch (error) {
      console.error("Import error:", error);
      setImportMessage(error instanceof Error ? error.message : "Errore durante l'importazione");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clienti</h2>
          <p className="text-gray-500">Gestione e visualizzazione dei clienti</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp size={16} className="mr-2" />
            Importa Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleExcelImport}
          />
          <Button onClick={openCreateDialog}>
            <Plus size={16} className="mr-2" />
            Nuovo Cliente
          </Button>
        </div>
      </div>
      {importMessage && <p className="text-sm text-gray-600" role="status">{importMessage}</p>}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Cerca cliente..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={filterSector} onValueChange={(value) => { setFilterSector(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Settore" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>{s || "Tutti i settori"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRegion} onValueChange={(value) => { setFilterRegion(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Regione" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>{r || "Tutte le regioni"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsColumnMenuOpen((open) => !open)}
                aria-expanded={isColumnMenuOpen}
                aria-controls="client-columns-menu"
              >
                <Columns3 size={16} className="mr-2" />
                Colonne
              </Button>
              {isColumnMenuOpen && (
                <div
                  id="client-columns-menu"
                  className="absolute right-0 z-20 mt-2 w-60 rounded-md border bg-white p-3 shadow-lg"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Colonne visibili</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1.5 py-1 text-xs"
                      onClick={() => setVisibleColumns(defaultVisibleColumns)}
                    >
                      Ripristina
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {clientColumns.map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(key)}
                          onChange={() => toggleColumn(key)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((key) => (
                    <TableHead key={key}>{clientColumns.find((column) => column.key === key)?.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-gray-500">
                      Nessun cliente trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedClients.map((client) => (
                    <TableRow key={client.id}>
                      {visibleColumns.map((key) => (
                        <TableCell key={key} className={key === "ragione_sociale" ? "font-medium" : undefined}>
                          {client[key] || "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(client)}>
                                  <Edit2 size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modifica</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(client)}>
                                  <Trash2 size={16} className="text-red-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Elimina</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredClients.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
              <span>
                Visualizzati {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredClients.length)} di {filteredClients.length} clienti
              </span>
              <div className="flex items-center gap-2">
                <span>Per pagina</span>
                <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                  <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[20, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Precedente</Button>
                <span>Pagina {currentPage} di {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Successiva</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Modifica Cliente" : "Nuovo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label>Ragione Sociale *</Label>
              <Input
                value={formData.ragione_sociale}
                onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Partita IVA</Label>
                <Input
                  value={formData.partita_iva}
                  onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                />
              </div>
              <div>
                <Label>Taglia Aziendale</Label>
                <Select
                  value={formData.taglia_aziendale}
                  onValueChange={(v) => setFormData({ ...formData, taglia_aziendale: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Micro">Micro</SelectItem>
                    <SelectItem value="Piccola">Piccola</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Grande">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Settore</Label>
                <Input
                  value={formData.settore}
                  onChange={(e) => setFormData({ ...formData, settore: e.target.value })}
                />
              </div>
              <div>
                <Label>Regione</Label>
                <Input
                  value={formData.regione}
                  onChange={(e) => setFormData({ ...formData, regione: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Requisiti</Label>
              <Textarea
                value={formData.requisiti}
                onChange={(e) => setFormData({ ...formData, requisiti: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit">{editingClient ? "Salva" : "Crea"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Sei sicuro di voler eliminare <strong>{clientToDelete?.ragione_sociale}</strong>?
            Questa azione non può essere annullata.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
