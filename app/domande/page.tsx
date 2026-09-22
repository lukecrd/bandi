"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, FileUp, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modulo, Domanda, DocumentType, ModuloType, CampoTemplate } from "@/lib/types";
import { moduloTemplates } from "@/lib/document-mapper";

interface DomandaRow extends Domanda {
  client_name?: string;
  band_title?: string;
}

interface ModuloWithParsed extends Modulo {
  dati: Record<string, { valore: string; fonte: string; compilato: boolean } | string>;
}

interface AutoFillResponse {
  modulo: Modulo & { dati: Record<string, { valore: string; fonte: string; compilato: boolean }> };
  applicabili: DocumentType[];
  documenti: any[];
}

const documentLabels: Record<DocumentType, string> = {
  iban: "IBAN",
  iscrizione_inps: "Iscrizione INPS/INAIL",
  polizza_catastrofale: "Polizza Catastrofale",
  visura: "Visura Aziendale",
  fatture: "Fatture/Quittanze",
  quietanza: "Quietanza Pagamento",
};

const moduloLabels: Record<ModuloType, string> = {
  domanda_bando: "Domanda Bando",
  delega_bando: "Delega Bando",
  allegato_a: "Allegato A",
  dichiarazione_inps: "Dichiarazione Sostitutiva INPS/INAIL",
};

function getCampoValue(dati: any, nome: string): string {
  if (!dati) return "";
  const d = dati[nome];
  if (!d) return "";
  if (typeof d === "string") return d;
  return d.valore || "";
}

function isCompilato(dati: any, nome: string): boolean {
  if (!dati) return false;
  const d = dati[nome];
  if (!d) return false;
  if (typeof d === "string") return false;
  return !!d.compilato;
}

function getFonte(dati: any, nome: string): string {
  if (!dati) return "";
  const d = dati[nome];
  if (!d) return "";
  if (typeof d === "string") return "";
  return d.fonte || "";
}

export default function DomandePage() {
  const router = useRouter();
  const [domande, setDomande] = useState<DomandaRow[]>([]);
  const [selectedDomanda, setSelectedDomanda] = useState<DomandaRow | null>(null);
  const [documenti, setDocumenti] = useState<any[]>([]);
  const [moduli, setModuli] = useState<ModuloWithParsed[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [bands, setBands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedBandId, setSelectedBandId] = useState("");
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("visura");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clRes, bRes] = await Promise.all([
        fetch("/api/clients").then((r) => r.json()),
        fetch("/api/bands").then((r) => r.json()),
      ]);
      setClients(clRes.clients || []);
      setBands((bRes.bands || []).slice(0, 50));
    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

  const loadDomande = async (clientId?: string) => {
    try {
      const url = clientId ? `/api/domande?clientId=${clientId}` : "/api/domande";
      const res = await fetch(url);
      const data = await res.json();
      setDomande(data.domande || []);
    } catch (e) {
      console.error("Error loading domande:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDomandaDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/domande/${id}`);
      const data = await res.json();
      setSelectedDomanda(data.domanda as DomandaRow);
      setDocumenti(data.documenti || []);
      setModuli((data.moduli || []).map((m: any) => ({ ...m, dati: m.dati || {} })));
    } catch (e) {
      console.error("Error loading detail:", e);
    }
  };

  const handleCreate = async () => {
    if (!selectedClientId || !selectedBandId) return;
    try {
      const res = await fetch("/api/domande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClientId, band_id: selectedBandId, note: "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setSelectedClientId("");
        setSelectedBandId("");
        loadDomande();
        loadDomandaDetail(data.domanda.id);
      }
    } catch (e) {
      console.error("Error creating:", e);
    }
  };

  const handleUpload = async () => {
    if (!fileRef.current || !fileRef.current.files?.[0] || !selectedDomanda) return;
    const file = fileRef.current.files[0];

    try {
      const docType = mapFileNameToDocType(file.name);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/domande/${selectedDomanda.id}/documenti`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setDocumenti((prev) => [...prev, data.documento]);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setShowUpload(false);
      setSelectedDocType("visura");
    }
  };

  const mapFileNameToDocType = (fileName: string): DocumentType => {
    const lower = fileName.toLowerCase();
    if (lower.includes("iban")) return "iban";
    if (lower.includes("inps") || lower.includes("inail")) return "iscrizione_inps";
    if (lower.includes("polizza") || lower.includes("catastro")) return "polizza_catastrofale";
    if (lower.includes("fattura") || lower.includes("quittanza")) return "fatture";
    if (lower.includes("quietanza") || lower.includes("pagamento")) return "quietanza";
    return "visura";
  };

  const handleAutoFill = async (moduloType: ModuloType) => {
    try {
      const res = await fetch(`/api/domande/${selectedDomanda!.id}/autofill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: moduloType }),
      });
      if (res.ok) {
        const data = (await res.json()) as AutoFillResponse;
        setModuli((prev) =>
          prev.map((m) => (m.id === data.modulo.id ? { ...m, ...data.modulo, dati: data.modulo.dati } : m))
        );
      }
    } catch (e) {
      console.error("Auto-fill error:", e);
    }
  };

  const handleUpdateField = async (moduloId: string, campo: string, valore: string) => {
    try {
      const modulo = moduli.find((m) => m.id === moduloId);
      if (!modulo || !selectedDomanda) return;
      const currentVal = getCampoValue(modulo.dati, campo);
      const updatedDati: Record<string, any> = {};
      for (const [k, v] of Object.entries(modulo.dati || {})) {
        if (k === campo) {
          updatedDati[k] = typeof v === "object" && v !== null ? { ...v, valore } : valore;
        } else {
          updatedDati[k] = v;
        }
      }
      updatedDati[campo] = typeof modulo.dati?.[campo] === "object" && modulo.dati?.[campo] !== null
        ? { ...(modulo.dati[campo] as any), valore }
        : { valore, fonte: "", compilato: false };

      const res = await fetch(`/api/domande/${selectedDomanda.id}/moduli/${moduloId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dati: updatedDati }),
      });
      if (res.ok) {
        const data = await res.json();
        setModuli((prev) => prev.map((m) => (m.id === moduloId ? { ...m, ...data.modulo, dati: data.modulo.dati } : m)));
      }
    } catch (e) {
      console.error("Update error:", e);
    }
  };

  const statoColor: Record<string, string> = {
    bozza: "bg-gray-100 text-gray-700 border-gray-200",
    in_compilazione: "bg-yellow-100 text-yellow-700 border-yellow-200",
    pronta: "bg-blue-100 text-blue-700 border-blue-200",
    inviata: "bg-green-100 text-green-700 border-green-200",
    errata: "bg-red-100 text-red-700 border-red-200",
  };

  const renderModuliFields = (modulo: ModuloWithParsed, template: CampoTemplate[]) => {
    return template.map((campo) => {
      const dato = modulo.dati?.[campo.nome];
      const compilato = isCompilato(modulo.dati, campo.nome);
      const valore = getCampoValue(modulo.dati, campo.nome);
      const fonte = getFonte(modulo.dati, campo.nome);
      return (
        <div key={campo.nome} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 min-w-[120px]">{campo.etichetta}</span>
          {compilato ? (
            <div className="flex items-center gap-1">
              <CheckCircle size={12} className="text-green-500" />
              <span className="text-xs">{valore}</span>
              {fonte && <Badge variant="secondary" className="text-xs">{fonte}</Badge>}
            </div>
          ) : (
            <Input
              value={valore}
              onChange={(e) => handleUpdateField(modulo.id, campo.nome, e.target.value)}
              placeholder={campo.etichetta}
              className="text-xs h-7"
            />
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Domande</h2>
          <p className="text-gray-500">Gestione domande di bando e moduli</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-2" />
            Nuova Domanda
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Cerca domanda..." className="max-w-xs" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Bando</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Moduli</TableHead>
                  <TableHead>Documenti</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domande.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Nessuna domanda trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  domande.map((d) => {
                    const docCount = documenti.filter((doc) => doc.domanda_id === d.id).length;
                    return (
                      <TableRow
                        key={d.id}
                        className={`cursor-pointer ${selectedDomanda?.id === d.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => loadDomandaDetail(d.id)}
                      >
                        <TableCell className="font-medium">{d.client_name || "Cliente"}</TableCell>
                        <TableCell>{d.band_title || "Bando"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statoColor[d.stato] || ""}>
                            {d.stato}
                          </Badge>
                        </TableCell>
                        <TableCell>{moduli.filter((m) => m.domanda_id === d.id).length}</TableCell>
                        <TableCell>{docCount}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); loadDomandaDetail(d.id); }}>
                            <ArrowLeft size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedDomanda && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDomanda.client_name || "Cliente"} — {selectedDomanda.band_title || "Bando"}
                <Badge variant="outline" className={`ml-2 ${statoColor[selectedDomanda.stato] || ""}`}>
                  {selectedDomanda.stato}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
                  <FileUp size={14} className="mr-2" />
                  Carica Documento
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {moduli.map((modulo) => {
                  const template = moduloTemplates[modulo.tipo as ModuloType];
                  if (!template) return null;
                  return (
                    <Card key={modulo.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{moduloLabels[modulo.tipo as ModuloType] || modulo.tipo}</CardTitle>
                        <div className="flex gap-2 items-center">
                          <Badge variant="outline" className={`text-xs ${statoColor[modulo.stato] || ""}`}>
                            {modulo.stato}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        {renderModuliFields(modulo, template)}
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAutoFill(modulo.tipo as ModuloType)}>
                          <RefreshCw size={12} className="mr-1" />
                          Auto-Compila
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuova Domanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Cliente</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.ragione_sociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Bando</label>
              <Select value={selectedBandId} onValueChange={setSelectedBandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona bando" />
                </SelectTrigger>
                <SelectContent>
                  {bands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.titolo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annulla</Button>
            <Button onClick={handleCreate}>Crea</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Carica Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">Seleziona un file da caricare per la domanda</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
              className="hidden"
              onChange={handleUpload}
            />
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(documentLabels) as DocumentType[]).map((type) => (
                <Button key={type} variant={selectedDocType === type ? "default" : "outline"} onClick={() => setSelectedDocType(type)}>
                  {documentLabels[type]}
                </Button>
              ))}
            </div>
            <Button onClick={() => fileRef.current?.click()}>Scegli File</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
