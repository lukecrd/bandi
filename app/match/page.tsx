"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Loader2,
  Target,
  Euro,
  MapPin,
  Calendar,
  ArrowRight,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Client, Match } from "@/lib/types";

type MatchWithDetails = Match & {
  client_name?: string;
  band_title?: string;
  ente?: string;
  regione?: string;
  settore?: string;
  importo?: string;
  scadenza?: string;
  source?: string;
};

export default function MatchPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMatch, setDetailMatch] = useState<MatchWithDetails | null>(null);

  const loadMatches = useCallback(async (clientId = "") => {
    const response = await fetch(clientId ? `/api/match/${clientId}` : "/api/match");
    const data = await response.json() as { matches?: MatchWithDetails[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Impossibile caricare i match");
    setMatches(data.matches || []);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/clients");
        const data = await response.json() as { clients?: Client[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Impossibile caricare i clienti");
        setClients(data.clients || []);
        await loadMatches();
      } catch (error) {
        setMatchError(error instanceof Error ? error.message : "Impossibile caricare i dati");
      }
    };
    void load();
  }, [loadMatches]);

  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    setMatchError(null);
    try {
      await loadMatches(clientId);
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "Impossibile caricare i match");
    }
  };

  const clearClientFilter = async () => {
    setSelectedClientId("");
    setMatchError(null);
    try {
      await loadMatches();
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "Impossibile caricare i match");
    }
  };

  const handleCompute = async () => {
    setIsComputing(true);
    setMatchError(null);
    try {
      const clientsToAnalyze = selectedClientId
        ? clients.filter((client) => client.id === selectedClientId)
        : clients;

      for (const client of clientsToAnalyze) {
        const res = await fetch(`/api/match/${client.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Impossibile calcolare i match per ${client.ragione_sociale}`);
      }

      await loadMatches(selectedClientId);
    } catch (error) {
      console.error("Error computing matches:", error);
      setMatchError(error instanceof Error ? error.message : "Errore durante il calcolo dei match");
    } finally {
      setIsComputing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Alto";
    if (score >= 40) return "Medio";
    return "Basso";
  };

  const selectedClient = clients.find((client) => client.id === selectedClientId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Match Bandi-Clienti</h2>
        <p className="text-gray-500">Scopri i bandi più compatibili con i tuoi clienti</p>
      </div>

      {selectedClient && (
        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            {selectedClient.ragione_sociale.charAt(0)}
          </div>
          <div>
            <p className="font-medium">{selectedClient.ragione_sociale}</p>
            <p className="text-sm text-gray-500">{selectedClient.settore} · {selectedClient.regione} · {selectedClient.taglia_aziendale}</p>
          </div>
          <Button variant="ghost" onClick={() => void clearClientFilter()}>
            Mostra tutti
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[300px]">
          <label className="text-sm font-medium mb-1 block">Clienti da analizzare</label>
          <Select value={selectedClientId} onValueChange={(clientId) => void handleClientChange(clientId)}>
            <SelectTrigger>
              <SelectValue placeholder="Tutti i clienti vengono analizzati automaticamente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.ragione_sociale}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCompute} disabled={clients.length === 0 || isComputing}>
          {isComputing ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Calcolo...
            </>
          ) : (
            <>
              <TrendingUp size={16} className="mr-2" />
              Aggiorna Match automatici
            </>
          )}
        </Button>
      </div>

      {matchError && <p className="text-sm text-red-600" role="alert">{matchError}</p>}

      {isComputing && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        </div>
      )}

      {matches.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Match Totali</div>
                <div className="text-3xl font-bold mt-1">{matches.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Alto Punteggio</div>
                <div className="text-3xl font-bold mt-1">
                  {matches.filter((m) => m.score >= 70).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-gray-500">Punteggio Medio</div>
                <div className="text-3xl font-bold mt-1">
                  {matches.length > 0 ? Math.round(matches.reduce((a, b) => a + b.score, 0) / matches.length) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Abbinamenti cliente e bando</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedClient ? `Bandi compatibili per ${selectedClient.ragione_sociale}` : "Panoramica di tutti gli abbinamenti calcolati"}
                  </p>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  {matches.length} risultati
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 lg:grid-cols-2">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    className="group flex min-w-0 items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm active:translate-y-0"
                    onClick={() => { setDetailMatch(match); setDetailOpen(true); }}
                  >
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-blue-50 px-3 text-blue-700">
                      <span className="text-2xl font-bold leading-none">{Math.round(match.score)}</span>
                      <span className="mt-1 text-xs font-medium">su 100</span>
                    </div>
                    <div className="min-w-0 flex-1 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm">
                        <span className="max-w-[42%] truncate font-medium text-gray-700">
                          {match.client_name || selectedClient?.ragione_sociale || "Cliente"}
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-blue-500" />
                        <span className="truncate text-gray-500">Bando</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="line-clamp-2 font-semibold text-gray-900">{match.band_title || "Bando senza titolo"}</h4>
                        <Badge className={`shrink-0 text-xs ${getScoreColor(match.score)}`}>
                          {getScoreLabel(match.score)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-500">
                        {match.ente && <span className="flex items-center gap-1"><Landmark size={13} />{match.ente}</span>}
                        {match.regione && <span className="flex items-center gap-1"><MapPin size={13} />{match.regione}</span>}
                        {match.importo && <span className="flex items-center gap-1"><Euro size={13} />{match.importo}</span>}
                        {match.scadenza && <span className="flex items-center gap-1"><Calendar size={13} />{match.scadenza}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {matches.length === 0 && !isComputing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {selectedClient ? "Nessun bando associato a questo cliente" : "Nessun match calcolato"}
            </h3>
            <p className="text-gray-500">
              {selectedClient ? "Aggiorna i match per cercare bandi compatibili." : "Seleziona un cliente oppure aggiorna tutti i match per iniziare."}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailMatch ? `${detailMatch.score}% - Dettaglio Match` : "Dettaglio Match"}</DialogTitle>
          </DialogHeader>
          {detailMatch && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Titolo</Label><p className="text-sm">{detailMatch.band_title || "N/A"}</p></div>
                <div><Label>Punteggio</Label><p className="text-sm font-bold">{detailMatch.score}%</p></div>
                <div><Label>Ente</Label><p className="text-sm">{detailMatch.ente || "N/A"}</p></div>
                <div><Label>Regione</Label><p className="text-sm">{detailMatch.regione || "N/A"}</p></div>
                <div><Label>Importo</Label><p className="text-sm">{detailMatch.importo || "N/A"}</p></div>
                <div><Label>Scadenza</Label><p className="text-sm">{detailMatch.scadenza || "N/A"}</p></div>
              </div>
              <div><Label>Motivazione</Label><p className="text-sm text-gray-500">{detailMatch.motivazione || "N/A"}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
