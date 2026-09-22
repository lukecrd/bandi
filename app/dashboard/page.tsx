"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Search,
  TrendingUp,
  Plus,
  FileUp,
  ArrowRight,
  Building2,
  Target,
  Calendar,
  Euro,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Client, Band } from "@/lib/types";

const chartData = [
  { name: "Lun", value: 40 }, { name: "Mar", value: 65 }, { name: "Mer", value: 50 },
  { name: "Gio", value: 80 }, { name: "Ven", value: 55 }, { name: "Sab", value: 30 }, { name: "Dom", value: 20 },
];

const sectorData = [
  { name: "Technologie", value: 35, color: "#3B82F6" },
  { name: "Agricoltura", value: 25, color: "#10B981" },
  { name: "Edilizia", value: 20, color: "#F59E0B" },
  { name: "Energia", value: 12, color: "#EF4444" },
  { name: "Commercio", value: 8, color: "#8B5CF6" },
];

const regionData = [
  { name: "Lombardia", clients: 8 }, { name: "Lazio", clients: 6 },
  { name: "Veneto", clients: 4 }, { name: "Emilia-Romagna", clients: 3 },
  { name: "Toscana", clients: 3 },
];

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, bRes] = await Promise.all([fetch("/api/clients"), fetch("/api/bands")]);
        setClients(await cRes.json().then(d => d.clients));
        setBands(await bRes.json().then(d => d.bands));
      } catch (error) { console.error("Error loading dashboard:", error); }
      finally { setLoaded(true); }
    };
    load();
  }, []);

  if (!loaded) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  }

  const stats = [
    { label: "Clienti", value: clients.length.toString(), change: `${clients.length} registrati` },
    { label: "Bandi", value: bands.length.toString(), change: `${bands.length} disponibili` },
    { label: "Match", value: "0", change: "Calcola dalla pagina Match" },
    { label: "Budget", value: "€0", change: "Dai bandi selezionati" },
  ];

  const recentBands = bands.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-gray-500">Panoramica generale della piattaforma</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{stat.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <ArrowRight size={12} className="rotate-[-45deg]" />{stat.change}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Attività Settimanale</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Distribuzione per Settore</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : '0'}%`}>
                  {sectorData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Bandi Recenti</CardTitle></CardHeader>
          <CardContent>
            {recentBands.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nessun bando disponibile</p>
            ) : (
              <div className="space-y-3">
                {recentBands.map((band) => (
                  <div key={band.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{band.titolo}</p>
                      <p className="text-sm text-gray-500">{band.ente} · {band.regione}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Scadenza</p>
                      <p className="text-sm text-gray-500">{band.scadenza}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Clienti per Regione</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={regionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="clients" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/clients">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-2 bg-blue-50 rounded-lg"><Building2 className="text-blue-600" size={24} /></div>
              <div><p className="font-medium">Gestisci Clienti</p><p className="text-sm text-gray-500">Aggiungi e gestisci i tuoi clienti</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bands">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-2 bg-green-50 rounded-lg"><Target className="text-green-600" size={24} /></div>
              <div><p className="font-medium">Cerca Bandi</p><p className="text-sm text-gray-500">Scopri nuovi bandi disponibili</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/match">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="text-purple-600" size={24} /></div>
              <div><p className="font-medium">Visualizza Match</p><p className="text-sm text-gray-500">Scopri i bandi per i tuoi clienti</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/clients">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-2 bg-orange-50 rounded-lg"><Calendar className="text-orange-600" size={24} /></div>
              <div><p className="font-medium">Importa Excel</p><p className="text-sm text-gray-500">Importa clienti da foglio Excel</p></div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
