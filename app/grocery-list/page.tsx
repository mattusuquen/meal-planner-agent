"use client";

import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import CategorySection from "@/components/shared/CategorySection";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import PillBadge from "@/components/ui/PillBadge";

interface GroceryItem {
  id: string;
  name: string;
  amount: string;
}

interface Category {
  name: string;
  icon: string;
  headerColor: string;
  items: GroceryItem[];
}

const categories: Category[] = [
  {
    name: "Produce",
    icon: "🥦",
    headerColor: "bg-green-50 border-green-200",
    items: [
      { id: "p1", name: "Spinach", amount: "2 bags (5 oz each)" },
      { id: "p2", name: "Broccoli", amount: "1 head" },
      { id: "p3", name: "Cherry Tomatoes", amount: "1 pint" },
      { id: "p4", name: "Avocado", amount: "4 ripe" },
      { id: "p5", name: "Mixed Greens", amount: "1 bag (5 oz)" },
      { id: "p6", name: "Bell Peppers", amount: "3 (assorted)" },
      { id: "p7", name: "Zucchini", amount: "2 medium" },
    ],
  },
  {
    name: "Proteins",
    icon: "🥩",
    headerColor: "bg-red-50 border-red-200",
    items: [
      { id: "pr1", name: "Chicken Breast", amount: "3 lbs" },
      { id: "pr2", name: "Salmon Fillet", amount: "1.5 lbs" },
      { id: "pr3", name: "Ground Turkey", amount: "1 lb" },
      { id: "pr4", name: "Large Eggs", amount: "1 dozen" },
      { id: "pr5", name: "Shrimp (peeled)", amount: "1 lb" },
    ],
  },
  {
    name: "Dairy",
    icon: "🥛",
    headerColor: "bg-blue-50 border-blue-200",
    items: [
      { id: "d1", name: "Greek Yogurt (plain)", amount: "32 oz" },
      { id: "d2", name: "Cottage Cheese", amount: "16 oz" },
      { id: "d3", name: "Shredded Mozzarella", amount: "8 oz" },
      { id: "d4", name: "Almond Milk", amount: "½ gallon" },
    ],
  },
  {
    name: "Pantry",
    icon: "🫙",
    headerColor: "bg-amber-50 border-amber-200",
    items: [
      { id: "pa1", name: "Olive Oil", amount: "1 bottle" },
      { id: "pa2", name: "Almond Butter", amount: "16 oz jar" },
      { id: "pa3", name: "Soy Sauce (low sodium)", amount: "1 bottle" },
      { id: "pa4", name: "Canned Chickpeas", amount: "2 cans (15 oz)" },
      { id: "pa5", name: "Chicken Broth", amount: "32 oz carton" },
      { id: "pa6", name: "Honey", amount: "small jar" },
    ],
  },
  {
    name: "Grains",
    icon: "🌾",
    headerColor: "bg-yellow-50 border-yellow-200",
    items: [
      { id: "g1", name: "Brown Rice", amount: "2 lbs bag" },
      { id: "g2", name: "Rolled Oats", amount: "1 lb bag" },
      { id: "g3", name: "Whole Wheat Tortillas", amount: "1 pack (10 count)" },
      { id: "g4", name: "Quinoa", amount: "1 lb bag" },
      { id: "g5", name: "Whole Wheat Bread", amount: "1 loaf" },
    ],
  },
];

const INITIAL_CHECKED = new Set(["p3", "d4", "pa1"]);
const allItems = categories.flatMap((c) => c.items.map((i) => i.id));

export default function GroceryListPage() {
  const [checked, setChecked] = useState<Set<string>>(INITIAL_CHECKED);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markAll = () => setChecked(new Set(allItems));
  const clearAll = () => setChecked(new Set());

  const totalItems = allItems.length;
  const checkedCount = checked.size;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title="Grocery List" subtitle="Week of Jun 30">
        <Button variant="secondary" size="sm" onClick={clearAll}>Clear All</Button>
        <Button variant="primary" size="sm" onClick={markAll}>Mark All</Button>
      </PageHeader>

      {/* Stats strip */}
      <Card className="flex items-center gap-4 mb-6 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-brand-500" />
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{checkedCount}</span> / {totalItems} items checked
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-sm text-gray-500">{categories.length} categories</span>
        <div className="ml-auto flex-1 max-w-32">
          <ProgressBar value={(checkedCount / totalItems) * 100} />
        </div>
        <span className="text-sm font-semibold text-brand-600">{Math.round((checkedCount / totalItems) * 100)}%</span>
      </Card>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const catChecked = cat.items.filter((i) => checked.has(i.id)).length;
          return (
            <CategorySection
              key={cat.name}
              icon={cat.icon}
              label={cat.name}
              headerColorClass={`${cat.headerColor} border-b`}
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
          );
        })}
      </div>
    </div>
  );
}
