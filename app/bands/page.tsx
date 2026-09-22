"use client";

import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  ExternalLink,
  Loader2,
  Euro,
  Building2,
  Target,
  TrendingUp,
  Calendar,
  MapPin,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Band } from "@/lib/types";

export default function BandsPage() {
  const [bands, setBands] = useState<Band[]>([]);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [region, setRegion] = useState("");
  const [source, setSource] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBands = async (showLoading = true, refresh = false) => {
    if (showLoading) setIsLoading(true);
    if (refresh) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sector) params.set("settore", sector);
      if (region) params.set("regione", region);
      if (source !== "all") params.set("source", source);
      if (refresh) params.set("refresh", "true");

      const res = await fetch(`/api/bands?${params.toString()}`);
      const data = await res.json();
      setBands(data.bands);
    } catch (error) {
      console.error("Error loading bands:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadBands(); }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadBands(false, true);
  };

  const sectors = ["", ...Array.from(new Set(bands.map((b) => b.settore)))];
  const regions = ["", ...Array.from(new Set(bands.map((b) => b.regione)))];
  const sources = ["", ...Array.from(new Set(bands.map((b) => b.source)))];

  const filteredBands = bands.filter((band) => {
    const matchesSearch = !search || band.titolo.toLowerCase().includes(search.toLowerCase()) || band.ente.toLowerCase().includes(search.toLowerCase());
    const matchesSector = !sector || band.settore === sector;
    const matchesRegion = !region || band.regione === region;
    const matchesSource = source === "all" || band.source === source;
    return matchesSearch && matchesSector && matchesRegion && matchesSource;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bandi</h2>
          <p className="text-gray-500">Ricerca e visualizzazione dei bandi disponibili</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw size={16} className={`mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Cerca per titolo o ente..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setTimeout(() => loadBands(false), 300); }}
                className="pl-9"
              />
            </div>
            <Select value={sector} onValueChange={(v) => { setSector(v); loadBands(false); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Settore" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>{s || "Tutti i settori"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={region} onValueChange={(v) => { setRegion(v); loadBands(false); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Regione" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>{r || "Tutte le regioni"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => { setSource(v); loadBands(false); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le fonti</SelectItem>
                {sources.filter(s => s).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Ente</TableHead>
                    <TableHead>Regione</TableHead>
                    <TableHead>Settore</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBands.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Nessun bando trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBands.map((band) => (
                      <TableRow key={band.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium max-w-[250px]">
                          <div className="truncate">{band.titolo}</div>
                        </TableCell>
                        <TableCell>{band.ente}</TableCell>
                        <TableCell>{band.regione}</TableCell>
                        <TableCell>{band.settore}</TableCell>
                        <TableCell>{band.importo}</TableCell>
                        <TableCell>{band.scadenza}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{band.source}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {band.link ? (
                            <a href={band.link} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon">
                                <ExternalLink size={16} />
                              </Button>
                            </a>
                          ) : (
                            <Button variant="ghost" size="icon" disabled>
                              <ExternalLink size={16} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
