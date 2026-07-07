"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import FadeIn from "@/components/ui/FadeIn";
import type { WeightEntry } from "@/lib/types";

interface DisplayEntry {
  id: string;
  date: string;        // display string
  isoDate: string;     // for API
  weight: number;      // lbs
  weight_kg: number;
  rolling: number | null;
}

function calcRolling(entries: DisplayEntry[], window = 7): DisplayEntry[] {
  return entries.map((e, i) => {
    if (i < window - 1) return { ...e, rolling: null };
    const slice = entries.slice(i - window + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.weight, 0) / window;
    return { ...e, rolling: parseFloat(avg.toFixed(1)) };
  });
}

const today = new Date().toISOString().split("T")[0];

export default function WeightPage() {
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [newDate, setNewDate] = useState(today);
  const [newWeight, setNewWeight] = useState("");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/weight?limit=90");
    if (res.ok) {
      const { entries: data } = await res.json();
      const display: DisplayEntry[] = (data as WeightEntry[]).map((e) => ({
        id: e.id,
        date: new Date(e.entry_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isoDate: e.entry_date,
        weight: Math.round(e.weight_kg * 2.20462 * 10) / 10,
        weight_kg: e.weight_kg,
        rolling: null,
      }));
      setEntries(calcRolling(display));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleLog = async () => {
    const w = parseFloat(newWeight);
    if (!newDate || isNaN(w) || w <= 0) return;
    setLogging(true);
    const res = await fetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_date: newDate, weight_lbs: w }),
    });
    if (res.ok) {
      await fetchEntries();
      setNewWeight("");
    }
    setLogging(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/weight?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => calcRolling(prev.filter((e) => e.id !== id)));
    }
  };

  const chartData = entries;
  const currentWeight = entries[entries.length - 1]?.weight ?? null;
  const startWeight = entries[0]?.weight ?? null;
  const totalChange = currentWeight && startWeight ? parseFloat((currentWeight - startWeight).toFixed(1)) : null;

  const recent7 = entries.slice(-7);
  const weeklyRate =
    recent7.length >= 2
      ? parseFloat(((recent7[recent7.length - 1].weight - recent7[0].weight) / ((recent7.length - 1) / 7)).toFixed(2))
      : null;

  const weightMin = entries.length ? Math.floor(Math.min(...entries.map((e) => e.weight)) - 2) : 150;
  const weightMax = entries.length ? Math.ceil(Math.max(...entries.map((e) => e.weight)) + 2) : 200;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader title="Weight Tracker" subtitle={entries.length > 0 ? `${entries[0].date} – ${entries[entries.length - 1].date}` : "Track your progress"} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Current" value={currentWeight ? `${currentWeight} lbs` : "—"} size="sm" />
        <StatsCard label="Starting" value={startWeight ? `${startWeight} lbs` : "—"} valueColor="text-gray-500" size="sm" />
        <StatsCard
          label="Total Change"
          value={totalChange !== null ? `${totalChange > 0 ? "+" : ""}${totalChange} lbs` : "—"}
          valueColor={totalChange !== null && totalChange < 0 ? "text-green-600" : "text-red-500"}
          size="sm"
        />
        <StatsCard
          label="Weekly Rate"
          value={weeklyRate !== null ? `${weeklyRate > 0 ? "+" : ""}${weeklyRate} lbs/wk` : "—"}
          valueColor={weeklyRate !== null && weeklyRate < 0 ? "text-green-600" : "text-amber-600"}
          size="sm"
        />
      </div>

      {/* Log entry */}
      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Log Weight</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={newDate}
            max={today}
            onChange={(e) => setNewDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="e.g. 183.5"
              step="0.1"
              min="50"
              max="700"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-36"
            />
            <span className="text-sm text-gray-400">lbs</span>
          </div>
          <Button onClick={handleLog} disabled={logging || !newWeight}>
            {logging ? "Saving..." : "Log Entry"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <>
          <Card className="p-5 mb-6">
            <Skeleton className="h-5 w-28 mb-4" />
            <Skeleton className="w-full h-[280px]" />
          </Card>
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="divide-y divide-gray-50">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center text-gray-400 text-sm">
          No weight entries yet. Log your first weight above.
        </Card>
      ) : (
        <>
          {/* Chart */}
          <FadeIn delay={0}>
            <Card className="p-5 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Weight Trend</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.max(1, Math.floor(entries.length / 10))} />
                  <YAxis domain={[weightMin, weightMax]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}`} />
                  <Tooltip formatter={(v) => [`${v} lbs`]} />
                  <Legend />
                  <Line type="monotone" dataKey="weight" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 3, fill: "#94a3b8" }} name="Daily Weight" />
                  <Line type="monotone" dataKey="rolling" stroke="#22c55e" strokeWidth={2.5} dot={false} connectNulls name="7-Day Avg" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </FadeIn>

          {/* Log table */}
          <FadeIn delay={80}>
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Entry History</h2>
                <span className="text-sm text-gray-400">{entries.length} entries</span>
              </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {[...entries].reverse().map((entry, idx, arr) => {
                const prev = arr[idx + 1];
                const change = prev ? parseFloat((entry.weight - prev.weight).toFixed(1)) : null;
                return (
                  <div key={entry.id} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{entry.date}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-900">{entry.weight} lbs</span>
                      {change !== null && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${change < 0 ? "bg-green-100 text-green-700" : change > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                          {change > 0 ? "+" : ""}{change} lbs
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </Card>
          </FadeIn>
        </>
      )}
    </div>
  );
}
