"use client";

import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import MacroDisplay from "@/components/ui/MacroDisplay";
import Skeleton from "@/components/ui/Skeleton";
import FadeIn from "@/components/ui/FadeIn";
import type { Recipe, RecipeIngredient } from "@/lib/types";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recipe detail state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const handleRecipeClick = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDetail(null);
    setLoadingDetail(true);
    const res = await fetch(`/api/recipes/${recipe.id}`);
    if (res.ok) {
      const { recipe: detail } = await res.json();
      setRecipeDetail(detail);
    }
    setLoadingDetail(false);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="w-full h-44 rounded-none" />
              <div className="p-4">
                <Skeleton className="h-5 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No recipes yet</h3>
          <p className="text-gray-500 text-sm mb-6">Generate your first AI recipe with verified nutritional data.</p>
          <Button onClick={() => setShowModal(true)}>Generate Recipe</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe, i) => (
            <FadeIn key={recipe.id} delay={i * 60}>
              <button
                className="w-full text-left"
                onClick={() => handleRecipeClick(recipe)}
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
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
              </button>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Recipe detail modal */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            {selectedRecipe.image_url ? (
              <div className="relative">
                <img
                  src={selectedRecipe.image_url}
                  alt={selectedRecipe.name}
                  className="w-full h-52 object-cover sm:rounded-t-2xl"
                />
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="relative w-full h-36 bg-gray-100 flex items-center justify-center sm:rounded-t-2xl">
                <span className="text-5xl">🍽️</span>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-gray-600 hover:bg-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedRecipe.name}</h2>
                {selectedRecipe.cuisine && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5">
                    {selectedRecipe.cuisine}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                <span>{selectedRecipe.calories} cal/serving</span>
                {selectedRecipe.prep_minutes && <span>· {selectedRecipe.prep_minutes}m prep</span>}
                <span>· {selectedRecipe.servings} servings</span>
              </div>

              {/* Macros */}
              <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-400 font-medium">Protein</p>
                  <p className="text-sm font-bold text-blue-600">{selectedRecipe.protein_g}g</p>
                </div>
                <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-400 font-medium">Carbs</p>
                  <p className="text-sm font-bold text-amber-600">{selectedRecipe.carbs_g}g</p>
                </div>
                <div className="flex-1 bg-rose-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-rose-400 font-medium">Fat</p>
                  <p className="text-sm font-bold text-rose-600">{selectedRecipe.fat_g}g</p>
                </div>
              </div>

              {loadingDetail ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24 mb-2" />
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-3 w-full" />
                  ))}
                </div>
              ) : recipeDetail ? (
                <>
                  {/* Ingredients */}
                  {recipeDetail.recipe_ingredients && recipeDetail.recipe_ingredients.length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingredients</h3>
                      <ul className="space-y-1.5">
                        {recipeDetail.recipe_ingredients.map((ing: RecipeIngredient, j: number) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
                            <span>{ing.raw_text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {recipeDetail.instructions && recipeDetail.instructions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h3>
                      <ol className="space-y-3">
                        {recipeDetail.instructions.map((step: string, j: number) => (
                          <li key={j} className="flex gap-3 text-sm text-gray-600">
                            <span className="flex-shrink-0 w-5 h-5 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xs font-semibold">
                              {j + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
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
