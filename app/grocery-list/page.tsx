"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/shared/PageHeader";
import CategorySection from "@/components/shared/CategorySection";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import PillBadge from "@/components/ui/PillBadge";
import Skeleton from "@/components/ui/Skeleton";
import FadeIn from "@/components/ui/FadeIn";

interface GroceryItem {
  id: string;
  name: string;
  amount: string;
}

interface Category {
  name: string;
  icon: string;
  items: GroceryItem[];
}

const CAT_COLORS: Record<string, string> = {
  Produce: "bg-green-50 border-green-200",
  Proteins: "bg-red-50 border-red-200",
  Dairy: "bg-blue-50 border-blue-200",
  Pantry: "bg-amber-50 border-amber-200",
  Grains: "bg-yellow-50 border-yellow-200",
  Other: "bg-gray-50 border-gray-200",
};

export default function GroceryListPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/grocery/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { categories: data } = await res.json();
      setCategories(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allItems = categories.flatMap((c) => c.items.map((i) => i.id));
  const totalItems = allItems.length;
  const checkedCount = checked.size;

  const handleGenerate = async () => {
    setGenerating(true);
    setChecked(new Set());
    await fetchList();
    setGenerating(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title="Grocery List" subtitle="From your current meal plan">
        <Button variant="secondary" size="sm" onClick={() => setChecked(new Set())}>Clear</Button>
        <Button variant="secondary" size="sm" onClick={() => setChecked(new Set(allItems))}>Mark All</Button>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "Refreshing..." : "Refresh"}
        </Button>
      </PageHeader>

      {loading ? (
        <>
          <Card className="flex items-center gap-4 mb-6 px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <div className="h-4 w-px bg-gray-200" />
            <Skeleton className="h-4 w-20" />
            <div className="ml-auto flex-1 max-w-32">
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <Skeleton className="h-4 w-8" />
          </Card>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-6 h-6 rounded" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                <div className="divide-y divide-gray-50">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="flex items-center gap-3 px-5 py-3">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : categories.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No grocery list yet</h3>
          <p className="text-gray-500 text-sm mb-6">Generate a meal plan first, then your grocery list will appear here.</p>
          <Button onClick={() => window.location.href = "/meal-plan"}>Go to Meal Plan</Button>
        </Card>
      ) : (
        <>
          <FadeIn delay={0}>
            <Card className="flex items-center gap-4 mb-6 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-brand-500" />
                <span className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{checkedCount}</span> / {totalItems} items
                </span>
              </div>
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-sm text-gray-500">{categories.length} categories</span>
              <div className="ml-auto flex-1 max-w-32">
                <ProgressBar value={totalItems > 0 ? (checkedCount / totalItems) * 100 : 0} />
              </div>
              <span className="text-sm font-semibold text-brand-600">
                {totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%
              </span>
            </Card>
          </FadeIn>

          <div className="space-y-4">
            {categories.map((cat, i) => {
              const catChecked = cat.items.filter((i) => checked.has(i.id)).length;
              const headerColor = CAT_COLORS[cat.name] ?? "bg-gray-50 border-gray-200";
              return (
                <FadeIn key={cat.name} delay={80 + i * 70}>
                <CategorySection
                  icon={cat.icon}
                  label={cat.name}
                  headerColorClass={`${headerColor} border-b`}
                  badge={
                    <PillBadge
                      label={`${catChecked} / ${cat.items.length} acquired`}
                      className={catChecked === cat.items.length ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}
                      size="sm"
                    />
                  }
                >
                  <div className="divide-y divide-gray-50">
                    {cat.items.map((item) => {
                      const isChecked = checked.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 accent-brand-600 cursor-pointer"
                          />
                          <span className={`flex-1 text-sm font-medium transition-all ${isChecked ? "line-through text-gray-300" : "text-gray-800"}`}>
                            {item.name}
                          </span>
                          <span className={`text-xs transition-all ${isChecked ? "text-gray-300" : "text-gray-400"}`}>
                            {item.amount}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CategorySection>
                </FadeIn>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
