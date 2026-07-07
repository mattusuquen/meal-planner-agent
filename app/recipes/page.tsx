"use client";

import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import MacroDisplay from "@/components/ui/MacroDisplay";
import type { Recipe } from "@/lib/types";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRecipes = async () => {
    const res = await fetch("/api/recipes");
    if (res.ok) {
      const { recipes: data } = await res.json();
      setRecipes(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipes();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShowModal(false);

    const res = await fetch("/api/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt || undefined, cuisine: cuisine || undefined }),
    });

    if (!res.ok) {
      setError("Failed to generate recipe. Please try again.");
      setGenerating(false);
      return;
    }

    const { recipe } = await res.json();
    setRecipes((prev) => [recipe, ...prev]);
    setGenerating(false);
    setPrompt("");
    setCuisine("");

    // Poll for image update
    if (recipe && !recipe.image_url) {
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        const res2 = await fetch(`/api/recipes/${recipe.id}/image`);
        if (res2.ok) {
          const { image_url } = await res2.json();
          if (image_url) {
            setRecipes((prev) =>
              prev.map((r) => r.id === recipe.id ? { ...r, image_url } : r)
            );
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
        if (attempts >= 12) {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }, 5000);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader title="Recipes" subtitle="AI-generated recipes with verified nutrition data">
        <Button onClick={() => setShowModal(true)} disabled={generating}>
          {generating ? "Generating..." : "+ Generate Recipe"}
        </Button>
      </PageHeader>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading recipes...</div>
      ) : recipes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No recipes yet</h3>
          <p className="text-gray-500 text-sm mb-6">Generate your first AI recipe with verified nutritional data.</p>
          <Button onClick={() => setShowModal(true)}>Generate Recipe</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden">
              {recipe.image_url ? (
                <img
                  src={recipe.image_url}
                  alt={recipe.name}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-gray-100 flex items-center justify-center">
                  <span className="text-4xl">🍽️</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                  {recipe.cuisine && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {recipe.cuisine}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                  <span>{recipe.calories} cal/serving</span>
                  {recipe.prep_minutes && <span>· {recipe.prep_minutes}m prep</span>}
                  <span>· {recipe.servings} servings</span>
                </div>
                <MacroDisplay
                  protein={recipe.protein_g}
                  carbs={recipe.carbs_g}
                  fat={recipe.fat_g}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Generate modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Recipe</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe your recipe (optional)
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. high-protein chicken bowl..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuisine style (optional)
                </label>
                <input
                  type="text"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  placeholder="e.g. Mediterranean, Asian..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button fullWidth onClick={handleGenerate}>
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
