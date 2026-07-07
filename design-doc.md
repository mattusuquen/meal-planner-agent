# Design Document: AI Food Tracking & Planning Agent

**Version:** 1.0
**Author:** Matt
**Status:** Draft

---

## 1. Overview

An AI-powered meal planning and nutrition tracking application. Users generate personalized meal plans and recipes via an AI agent, log meals against verified nutrition data, and monitor progress through recalculating dashboards. The core differentiator vs. generic AI tools: **nutrition accuracy backed by a real food database**, not LLM-estimated macros.

### Goals
- Generate meal plans and recipes tailored to user goals, preferences, and dietary restrictions
- Guarantee macro/calorie accuracy by grounding all nutrition data in the USDA FoodData Central database
- Provide progress dashboards that recalculate automatically as user data changes
- Enhance recipes with AI-generated images
- Act as an agent: proactively adjust plans based on logged data and progress trends

### Non-Goals (v1)
- Barcode scanning
- Wearable/fitness integrations
- Social features
- Native mobile apps (responsive web first)

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR for dashboards, API routes for agent logic, single deploy target |
| Language | TypeScript | End-to-end type safety, shared types between client and server |
| UI | React 19 + Tailwind CSS | Component model, fast iteration |
| Database | Supabase (PostgreSQL) | Relational integrity for nutrition data, RLS for per-user isolation, Postgres functions/triggers for recalculation |
| Auth | Supabase Auth | Email/password + OAuth (Google, Apple), integrates with RLS out of the box |
| AI — text | OpenAI GPT-4o-mini | Recipe generation, meal planning, ingredient parsing, agent reasoning |
| AI — images | gpt-image-1 (or Flux via Replicate) | Recipe imagery, generated once and cached |
| Nutrition data | USDA FoodData Central API | Authoritative, free, per-ingredient macros |
| Storage | Supabase Storage | Recipe images |
| Charts | Recharts | Dashboard visualizations |
| Hosting | Vercel | Native Next.js support |

---

## 3. Feature Set

### 3.1 Onboarding & Profile
- Goal selection: lose / maintain / gain weight, target rate
- Biometrics: age, sex, height, weight, activity level
- TDEE + macro target calculation (Mifflin-St Jeor), stored in profile
- Dietary preferences: cuisines, restrictions (vegan, gluten-free, etc.), allergies, disliked ingredients
- Meal structure preference (3 meals, 3 + snacks, IF windows)

### 3.2 AI Meal Planning Agent
- Generate daily or weekly meal plans hitting the user's macro targets within tolerance (±5%)
- Constraint-aware: respects allergies (hard constraint), preferences (soft constraint), budget/time flags
- Plan regeneration: swap a single meal or regenerate a full day without breaking daily macro targets
- Grocery list generation: aggregates ingredients across the plan, deduplicates, groups by category
- **Agentic behaviors:**
  - Weekly review: compares logged intake vs. plan, suggests adjustments
  - Adaptive targets: if weight trend deviates from goal rate for 2+ weeks, propose calorie target revision
  - Leftover awareness: suggests recipes using ingredients from earlier in the plan

### 3.3 Recipe System (Accuracy Core)
- **Generation pipeline:** LLM produces recipe (name, servings, instructions, structured ingredient list) → each ingredient fuzzy-matched to a USDA food entry → macros summed per serving from verified data → stored
- LLM never supplies final nutrition numbers; it only supplies ingredients and quantities
- Unmatched ingredients flagged for user confirmation with top-3 USDA candidates
- User-created and user-edited recipes run through the same matching + calculation pipeline
- Nutrition cache table avoids repeat USDA API calls
- Recipe scaling: servings adjustment recalculates all quantities and macros

### 3.4 AI Recipe Images
- Generated once at recipe creation from a prompt derived from the recipe (dish, plating, style consistency)
- Stored in Supabase Storage; URL saved on the recipe row
- Regenerated only on significant recipe edit (name or majority-ingredient change)
- Fallback placeholder by cuisine category if generation fails

### 3.5 Food Logging
- Log from: planned meal (one tap), saved recipe, USDA food search, free-text AI parse ("2 eggs and toast with butter" → structured entries), or **photo capture** (see 3.5.1)
- Per-log servings multiplier
- Edit/delete past logs (triggers recalculation, see 4.3)
- Quick-add for calories-only entries when detail is unavailable

#### 3.5.1 Photo Meal Tracking
- User snaps or uploads a photo of their meal; GPT-4o vision identifies foods and estimates portion sizes
- **Pipeline:** photo → vision model returns structured guess (foods + estimated quantities) → each item matched to USDA entries via the same ingredient matcher → macros calculated from verified data, never from the vision model's own estimates
- **Confirmation-first UX:** the parsed result is always shown as an editable draft before logging — user adjusts items, portions, or removes misidentified foods. Photo estimation is inherently approximate; the flow makes that transparent rather than pretending precision
- Confidence indicator per detected item; low-confidence items pre-flagged for review
- Photo stored in Supabase Storage, linked to the log entry — creates a visual food diary viewable in the dashboard
- Portion estimation aids: vision prompt includes reference-object heuristics (plate size, utensils) to improve quantity guesses
- Logged photo meals are marked `entry_method = 'photo'` so accuracy-sensitive views (agent weekly review) can weight them appropriately

### 3.6 Progress Dashboards
- **Daily:** macro rings (calories, protein, carbs, fat) vs. targets, logged meals list, remaining budget
- **Weekly/Monthly:** calorie and macro trend lines, adherence rate (days within target), average intake
- **Progress:** weight entries plotted against 7-day rolling calorie average — shows correlation between intake and results
- **Recipe stats:** most-cooked recipes, recipe count by user, cuisine distribution
- All aggregates read from precomputed tables (never sum raw logs on page load)

### 3.7 Weight & Metrics Tracking
- Weight entries with date (multiple metrics extensible: waist, body fat %)
- 7-day rolling average smoothing to reduce daily-fluctuation noise
- Trend rate calculation (lbs/week) feeding the agent's adaptive-target logic

---

## 4. Data Model

```sql
profiles (
  id uuid pk references auth.users,
  goal text, activity_level text,
  height_cm numeric, birth_date date, sex text,
  calorie_target int, protein_g int, carbs_g int, fat_g int,
  dietary_restrictions text[], allergies text[], dislikes text[]
)

recipes (
  id uuid pk, created_by uuid references profiles,
  name text, instructions jsonb, servings int,
  image_url text, source text check (source in ('ai','user')),
  cuisine text, prep_minutes int,
  -- denormalized verified totals per serving:
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric
)

recipe_ingredients (
  id uuid pk, recipe_id uuid references recipes on delete cascade,
  usda_fdc_id int references nutrition_cache,
  raw_text text, quantity numeric, unit text, grams numeric
)

nutrition_cache (
  usda_fdc_id int pk, description text,
  per_100g jsonb,          -- full macro/micro payload
  fetched_at timestamptz
)

meal_plans (
  id uuid pk, user_id uuid, week_start date, plan jsonb, status text
)

logged_meals (
  id uuid pk, user_id uuid, logged_date date,
  recipe_id uuid null, custom_entry jsonb null,
  servings numeric default 1, meal_slot text,
  entry_method text check (entry_method in ('plan','recipe','search','text','photo','quick')),
  photo_url text null
)

daily_totals (
  user_id uuid, date date,
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  meals_logged int,
  primary key (user_id, date)
)

weight_entries (
  id uuid pk, user_id uuid, entry_date date, weight_kg numeric
)
```

Row Level Security on all user-owned tables: `user_id = auth.uid()`.

---

## 5. Recalculation Architecture

The system guarantees dashboards are always consistent with underlying data:

1. **Write-time recomputation.** A Postgres trigger on `logged_meals` (INSERT/UPDATE/DELETE) upserts the affected user+date row in `daily_totals`. Editing a meal from three weeks ago recalculates exactly one row.
2. **Recipe edits cascade.** If a recipe's verified macros change, a trigger recomputes `daily_totals` for all dates where that recipe was logged (scoped query, batched).
3. **Target changes don't rewrite history.** Calorie/macro targets are read from `profiles` at render time and compared against stored totals — changing a target never requires recalculation.
4. **Rolling averages computed in SQL views** over `daily_totals` and `weight_entries`, not in application code.

---

## 6. AI Agent Architecture

```
User request → Next.js API route (agent orchestrator)
  ├── Plan generation: GPT-4o-mini with profile + constraints as system context
  ├── Recipe generation: structured output (JSON schema) → ingredient matcher
  ├── Ingredient matcher: USDA search API + embedding similarity fallback
  ├── Nutrition calculator: pure TS function over matched entries (no LLM)
  └── Image generation: async job post-save (non-blocking)
```

- Structured outputs (JSON schema mode) for all recipe/plan generation — no free-text parsing of LLM output
- Two-phase generation where useful: plan skeleton first, then per-recipe detail (mirrors proven pattern from SkillMap's pipeline)
- Agent memory: weekly review reads `daily_totals` + `weight_entries` trends, writes suggestions to a `agent_suggestions` table surfaced in-app

---

## 7. API Surface (Next.js Route Handlers)

| Route | Purpose |
|---|---|
| `POST /api/plan/generate` | Create weekly plan |
| `POST /api/plan/swap-meal` | Replace one meal, preserve daily targets |
| `POST /api/recipes/generate` | AI recipe → matched → verified → saved |
| `POST /api/recipes/:id/image` | Trigger image generation |
| `POST /api/log` | Log a meal (any entry type) |
| `POST /api/log/photo` | Upload photo → vision parse → editable draft |
| `GET /api/dashboard/daily?date=` | Daily totals + targets |
| `GET /api/dashboard/trends?range=` | Weekly/monthly aggregates |
| `POST /api/agent/review` | Run weekly adaptive review |

Supabase client used directly from the browser for simple reads (RLS-protected); route handlers own all writes involving computation.

---

## 8. Build Phases

1. **Foundation:** Auth, profiles, TDEE calc, schema + RLS
2. **Accuracy core:** USDA integration, ingredient matcher, nutrition calculator, recipe CRUD
3. **Logging + recalculation:** logged_meals, triggers, daily_totals
4. **Dashboards:** daily rings, trends, weight tracking
5. **AI planning agent:** plan generation, meal swap, grocery lists
6. **Polish:** AI images, free-text log parsing, weekly agent review

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Ingredient matching errors corrupt nutrition data | Confidence threshold + user confirmation flow for low-confidence matches |
| USDA API latency/downtime | `nutrition_cache` table; matcher falls back to cache-only search |
| LLM generates plans missing macro targets | Post-generation validation loop; regenerate meals until within ±5% or surface tolerance to user |
| Image generation cost | Generate once, cache forever; queue with rate limiting |
| Recalculation trigger performance at scale | Triggers touch single rows; recipe-edit cascade batched and async via pg_cron if needed |
| Photo portion estimates are inaccurate | Confirmation-first draft UX, per-item confidence flags, macros always from USDA matches (vision only identifies foods), photo logs tagged for accuracy weighting |