"use client";

import { useState } from "react";
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

interface WeightEntry {
  date: string;
  weight: number;
}

function calcRollingAvg(entries: WeightEntry[], window = 7): (WeightEntry & { rolling: number | null })[] {
  return entries.map((e, i) => {
    if (i < window - 1) return { ...e, rolling: null };
    const slice = entries.slice(i - window + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.weight, 0) / window;
    return { ...e, rolling: parseFloat(avg.toFixed(1)) };
  });
}

const BASE_ENTRIES: WeightEntry[] = [
  { date: "Jun 9", weight: 185.2 },
  { date: "Jun 10", weight: 185.8 },
  { date: "Jun 11", weight: 184.9 },
  { date: "Jun 12", weight: 185.4 },
  { date: "Jun 13", weight: 184.6 },
  { date: "Jun 14", weight: 184.2 },
  { date: "Jun 15", weight: 185.0 },
  { date: "Jun 16", weight: 184.1 },
  { date: "Jun 17", weight: 184.7 },
  { date: "Jun 18", weight: 183.9 },
  { date: "Jun 19", weight: 184.3 },
  { date: "Jun 20", weight: 183.5 },
  { date: "Jun 21", weight: 184.0 },
  { date: "Jun 22", weight: 183.2 },
  { date: "Jun 23", weight: 183.8 },
  { date: "Jun 24", weight: 182.9 },
  { date: "Jun 25", weight: 183.4 },
  { date: "Jun 26", weight: 182.7 },
  { date: "Jun 27", weight: 183.1 },
  { date: "Jun 28", weight: 182.4 },
  { date: "Jun 29", weight: 183.0 },
  { date: "Jun 30", weight: 182.2 },
  { date: "Jul 1", weight: 182.8 },
  { date: "Jul 2", weight: 181.9 },
  { date: "Jul 3", weight: 182.5 },
  { date: "Jul 4", weight: 181.7 },
  { date: "Jul 5", weight: 182.1 },
  { date: "Jul 6", weight: 183.1 },
];

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>(BASE_ENTRIES);
  const [newDate, setNewDate] = useState("");
  const [newWeight, setNewWeight] = useState("");

  const chartData = calcRollingAvg(entries);

  const currentWeight = entries[entries.length - 1]?.weight ?? 0;
  const startWeight = entries[0]?.weight ?? 0;
  const totalChange = parseFloat((currentWeight - startWeight).toFixed(1));

  const recent = entries.slice(-7);
  const weeklyRate =
    recent.length >= 2
      ? parseFloat(((recent[recent.length - 1].weight - recent[0].weight) / ((recent.length - 1) / 7)).toFixed(2))
      : 0;

  const handleLog = () => {
    const w = parseFloat(newWeight);
    if (!newDate || isNaN(w)) return;
    setEntries((prev) => [...prev, { date: newDate, weight: w }]);
    setNewDate("");
    setNewWeight("");
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader title="Weight Tracker" subtitle="Jun 9 – Jul 6, 2026" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Current" value={`${currentWeight} lbs`} size="sm" />
        <StatsCard label="Starting" value={`${startWeight} lbs`} valueColor="text-gray-500" size="sm" />
        <StatsCard
          label="Total Change"
          value={`${totalChange > 0 ? "+" : ""}${totalChange} lbs`}
          valueColor={totalChange < 0 ? "text-green-600" : "text-red-500"}
          size="sm"
        />
        <StatsCard
          label="Weekly Rate"
          value={`${weeklyRate > 0 ? "+" : ""}${weeklyRate} lbs/wk`}
          valueColor={weeklyRate < 0 ? "text-green-600" : "text-amber-600"}
          size="sm"
        />
      </div>

      {/* Log entry */}
      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Log Today&apos;s Weight</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={newDate}
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
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-36"
            />
            <span className="text-sm text-gray-400">lbs</span>
          </div>
          <Button onClick={handleLog}>Log Entry</Button>
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Weight Trend</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={3} />
            <YAxis domain={[179, 188]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}`} />
            <Tooltip formatter={(v) => [`${v} lbs`]} />
            <Legend />
            <Line type="monotone" dataKey="weight" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 3, fill: "#94a3b8" }} name="Daily Weight" />
            <Line type="monotone" dataKey="rolling" stroke="#22c55e" strokeWidth={2.5} dot={false} strokeDasharray="0" connectNulls name="7-Day Avg" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Log table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Entry History</h2>
          <span className="text-sm text-gray-400">{entries.length} entries</span>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {[...entries].reverse().map((entry, idx) => {
            const prevIdx = entries.length - 1 - idx - 1;
            const prev = entries[prevIdx];
            const change = prev ? parseFloat((entry.weight - prev.weight).toFixed(1)) : null;
            return (
              <div key={`${entry.date}-${entry.weight}`} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-700">{entry.date}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-900">{entry.weight} lbs</span>
                  {change !== null && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${change < 0 ? "bg-green-100 text-green-700" : change > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                      {change > 0 ? "+" : ""}{change} lbs
                    </span>
                  )}
                  <button className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
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
    </div>
  );
}
