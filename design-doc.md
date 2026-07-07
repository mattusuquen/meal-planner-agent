# Design Document: AI Food Tracking & Planning Agent

**Version:** 2.0
**Author:** Matt
**Status:** Implemented

---

## 1. Overview

An AI-powered meal planning and nutrition tracking application. Users generate personalized meal plans and recipes via an AI agent, log meals against verified nutrition data, and monitor progress through recalculating dashboards. The core differentiator vs. generic AI tools: **nutrition accuracy backed by a real food database**, not LLM-estimated macros.

### Goals
- Generate meal plans and recipes tailored to user goals, preferences, and dietary restrictions
- Guarantee macro/calorie accuracy by grounding all nutrition data in the USDA FoodData Central database
- Provide progress dashboards that recalculate automatically as user data changes
- Enhance recipes with AI-generated images
- Log meals via photo capture, free-text AI parse, USDA search, saved recipes, or meal plan

### Non-Goals (v1)
- Barcode scanning
- Wearable/fitness integrations
- Social features
- Native mobile apps (responsive web first)
- Agent weekly review / adaptive calorie target revision (planned v2)

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR for dashboards, API routes for agent logic. Auth proxy in `proxy.ts` (renamed from `middleware.ts` in Next.js 16) |
| Language | TypeScript | End-to-end type safety, shared types in `lib/types.ts` |
| UI | React + Tailwind CSS | Component model, reusable components in `components/shared/` and `components/ui/` |
| Database | Supabase (PostgreSQL) | Relational integrity for nutrition data, RLS for per-user isolation |
| Auth | Supabase Auth | Email/password. Session managed via `@supabase/ssr` cookie-based auth |
| AI — text | OpenAI GPT-4o-mini | Recipe generation, meal planning, ingredient/text parsing, meal swap |
| AI — images | OpenAI gpt-image-1 | Recipe imagery, generated once after save (fire-and-forget), stored in Supabase Storage |
| AI — vision | OpenAI GPT-4o-mini (vision) | Photo meal analysis — identifies foods and estimates portions |
| Nutrition data | USDA FoodData Central API | Authoritative, free, per-ingredient macros. Results cached in `nutrition_cache` table |
| Storage | Supabase Storage | `recipe-images` (public), `meal-photos` (private with signed URLs) |
| Charts | Recharts | Dashboard trend and progress charts |
| Hosting | Vercel | Native Next.js support |

---

## 3. Feature Set

### 3.1 Onboarding & Profile
- Multi-step onboarding: goal (lose/maintain/gain), target rate, age, sex, height, weight, activity level
- TDEE + macro target calculation (Mifflin-St Jeor via `lib/nutrition.ts`), stored in `profiles`
- Dietary preferences: cuisines, restrictions, allergies, disliked ingredients, meal structure
- Profile persisted to Supabase on completion; `onboarding_complete` flag gates all protected routes
- **Auth gate:** `proxy.ts` checks `profiles.onboarding_complete` — redirects to `/onboarding` only on first login. Returning users always land on `/dashboard`

### 3.2 AI Meal Planning
- Generate 7-day weekly meal plan hitting user's macro targets
- Constraint-aware: respects allergies (hard), preferences (soft), meal structure (3 meals or 3+snacks)
- Plan stored as JSONB keyed by ISO date strings (`"YYYY-MM-DD"`) for each day
- Swap single meal: GPT-4o-mini generates replacement within remaining daily macro budget
- Grocery list generation: aggregates recipe ingredients from plan, categorizes into Produce / Proteins / Dairy / Pantry / Grains / Other. Falls back to meal names for plans without linked recipes
- Week navigation: Monday-anchored, date-aware mobile day selector

### 3.3 Recipe System (Accuracy Core)
- **Generation pipeline:** GPT-4o-mini (structured JSON output via Zod schema) → each ingredient USDA-matched via `matchIngredient()` → macros summed per serving → stored in `recipes` + `recipe_ingredients`
- LLM never supplies final nutrition numbers — only ingredient names, quantities, and estimated grams. USDA data provides all macros
- Nutrition results cached in `nutrition_cache` to avoid repeat USDA API calls (admin service-role client bypasses RLS for cache writes)
- Recipe macros stored denormalized per serving on the `recipes` row for fast logging reads
- Fire-and-forget image generation: after recipe save, `POST /api/recipes/:id/image` is called without awaiting. Client polls `GET /api/recipes/:id/image` every 5s for up to 60s

### 3.4 Food Logging
- **Six entry methods:**
  1. **Photo** — upload/capture → GPT-4o-mini vision → USDA match → editable draft
  2. **From Plan** — tap any planned meal for today to log instantly (with servings multiplier)
  3. **Recipe** — pick from saved recipes, adjust servings
  4. **Search** — USDA FoodData Central search, gram-based entry (per 100g)
  5. **AI Parse** — describe meal in natural language → GPT-4o-mini parses items → USDA match → editable draft
  6. **Quick Add** — manual name + calories (macros optional)
- All methods surface an editable confirmation UI before anything is logged
- Per-log `servings` multiplier; macros scaled at read time
- Delete log entry triggers daily totals recalculation

#### Photo Meal Tracking Detail
- Photo uploaded to `meal-photos` Supabase Storage bucket (private); signed URL used for vision API call
- Vision model identifies foods and estimates grams; items USDA-matched for verified macros
- Confidence flag per item (`high`/`medium`/`low`); low-confidence items pre-highlighted for review
- Photo URL stored on the log entry for visual food diary

### 3.5 Progress Dashboards
- **Daily:** macro rings (calories, protein, carbs, fat vs. targets), calorie progress bar, today's log list
- **Weekly:** 7-day trend line chart (calories + macros), adherence rate (days within ±10% of target), avg calories/protein
- **Monthly:** 30-day calorie area chart vs. target line
- **Progress:** weight vs. daily calorie intake dual-axis chart, current weight, total change, weekly rate (lbs/wk)
- All aggregates read from `daily_totals` (precomputed on every log write) — no summing raw logs on page load

### 3.6 Weight Tracking
- Log weight by date (lbs on client, kg in database — converted in API)
- Upsert on `(user_id, entry_date)` unique constraint — one entry per day
- 7-day rolling average rate calculated in API code

---

## 4. Data Model

```sql
profiles (
  id uuid pk references auth.users,
  goal text,                          -- 'lose' | 'maintain' | 'gain'
  activity_level text,                -- 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  height_cm numeric, birth_date date, sex text,
  calorie_target int, protein_g int, carbs_g int, fat_g int,
  dietary_restrictions text[], allergies text[], dislikes text[], cuisines text[],
  meal_structure text,                -- '3_meals' | '3_plus_snacks' | 'if'
  display_name text,
  onboarding_complete boolean default false,
  created_at timestamptz, updated_at timestamptz
)

nutrition_cache (
  usda_fdc_id int pk,
  description text,
  per_100g jsonb,                     -- { calories, protein_g, carbs_g, fat_g }
  fetched_at timestamptz
)

recipes (
  id uuid pk, created_by uuid references profiles,
  name text, instructions jsonb,      -- array of step strings
  servings int, image_url text,
  source text,                        -- 'ai' | 'user'
  cuisine text, prep_minutes int,
  -- denormalized verified totals per serving:
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  created_at timestamptz
)

recipe_ingredients (
  id uuid pk, recipe_id uuid references recipes on delete cascade,
  usda_fdc_id int references nutrition_cache,
  raw_text text, quantity numeric, unit text, grams numeric
)

meal_plans (
  id uuid pk, user_id uuid references profiles,
  week_start date,
  plan jsonb,                         -- keyed by ISO date string "YYYY-MM-DD"
  status text,                        -- 'active' | 'archived'
  created_at timestamptz
)

logged_meals (
  id uuid pk, user_id uuid references profiles,
  logged_date date,
  recipe_id uuid null references recipes,
  custom_entry jsonb null,            -- { name, calories, protein_g, carbs_g, fat_g }
  servings numeric default 1,
  meal_slot text,                     -- 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'
  entry_method text,                  -- 'plan' | 'recipe' | 'search' | 'text' | 'photo' | 'quick'
  photo_url text null,
  created_at timestamptz
)

daily_totals (
  user_id uuid references profiles,
  date date,
  calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  meals_logged int,
  primary key (user_id, date)
)

weight_entries (
  id uuid pk, user_id uuid references profiles,
  entry_date date,
  weight_kg numeric,
  created_at timestamptz,
  unique (user_id, entry_date)
)
```

Row Level Security enabled on all user-owned tables: policy `auth.uid() = user_id` (or `= id` for profiles).

`nutrition_cache` RLS allows public SELECT; INSERT/UPDATE via service-role admin client only.

Auto-create profile trigger fires on `auth.users` INSERT. API routes also include a profile upsert guard (`ignoreDuplicates: true`) to handle users who signed up before the trigger existed.

---

## 5. Recalculation Architecture

Daily totals are kept consistent with logged meal data via **server-side recomputation on every write**:

1. Every `POST /api/log` and `DELETE /api/log` call `recalcDailyTotals(supabase, userId, date)` after the write
2. `recalcDailyTotals` in `lib/nutrition.ts` sums all `logged_meals` for the user+date (joining recipe macros where `recipe_id` is set, using `custom_entry` otherwise), then upserts the result into `daily_totals`
3. Dashboards and journal read from `daily_totals` — never sum raw logs at render time
4. Target changes (profile updates) never require recalculation — targets are read from `profiles` at render time and compared against stored totals

---

## 6. AI Agent Architecture

```
User request → Next.js API route
  ├── Plan generation:    GPT-4o-mini (json_object mode) with profile + macro targets as system context
  ├── Meal swap:          GPT-4o-mini generates replacement within remaining daily macro budget
  ├── Recipe generation:  GPT-4o-mini (Zod-validated JSON) → USDA ingredient matching → macro summation
  ├── Text parse:         GPT-4o-mini extracts food items + grams → USDA match → editable draft
  ├── Photo analysis:     GPT-4o-mini vision (signed Storage URL) → food items + grams → USDA match
  ├── Image generation:   gpt-image-1 (fire-and-forget after recipe save, uploaded to Storage)
  └── Nutrition calc:     Pure TS functions in lib/nutrition.ts — no LLM involvement in macro numbers
```

- All recipe/plan generation uses `response_format: { type: "json_object" }` with Zod validation — no free-text parsing of LLM output
- LLM produces *ingredient names and quantities only*; USDA data provides all final macro values
- USDA ingredient matching: `searchUSDA(name, limit=3)` → top result used, cached in `nutrition_cache` via admin client

---

## 7. API Surface

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/plan/generate` | Generate 7-day meal plan from profile |
| `GET` | `/api/plan?week_start=` | Fetch active plan for week |
| `POST` | `/api/plan/swap-meal` | Replace one meal within daily budget |
| `POST` | `/api/grocery/generate` | Aggregate plan ingredients into categorized list |
| `GET` | `/api/recipes` | List user's saved recipes |
| `POST` | `/api/recipes/generate` | AI recipe → USDA matched → saved |
| `POST` | `/api/recipes/:id/image` | Generate + upload recipe image |
| `GET` | `/api/recipes/:id/image` | Poll for image URL |
| `GET` | `/api/usda/search?q=&limit=` | Search USDA FoodData Central |
| `GET` | `/api/log?date=` | Fetch logged meals for a date |
| `POST` | `/api/log` | Log a meal entry |
| `DELETE` | `/api/log?id=` | Delete a log entry |
| `POST` | `/api/log/photo` | Upload photo → vision parse → draft items |
| `POST` | `/api/log/text` | Text parse → USDA match → draft items |
| `GET` | `/api/dashboard/daily?date=` | Daily totals + targets + meals |
| `GET` | `/api/dashboard/trends?period=` | 7 or 30-day daily_totals with summary stats |
| `GET` | `/api/weight?limit=` | Weight entries (ascending by date) |
| `POST` | `/api/weight` | Log weight (accepts `weight_lbs` or `weight_kg`) |
| `DELETE` | `/api/weight?id=` | Delete weight entry |

Supabase client used directly from the browser for reads where RLS is sufficient. Route handlers own all writes involving AI calls or multi-step computation.

---

## 8. Key Implementation Details

### Date Handling
All date strings are generated using `toLocaleDateString("en-CA")` (produces `YYYY-MM-DD` in local time) rather than `Date.toISOString().split("T")[0]` (which is UTC and causes off-by-one errors in non-UTC timezones). ISO date strings passed as props are always parsed as `new Date(str + "T12:00:00")` before calling local-time date methods.

### Auth Flow
- `/auth/login` and `/auth/signup` — email/password only
- `/auth/callback` — exchanges OAuth code for session, redirects to `/dashboard`
- `proxy.ts` — protects all routes except `/auth/*` and static assets. Unauthenticated → `/auth/login`. Authenticated + `onboarding_complete = false` → `/onboarding`. Authenticated on auth routes → `/dashboard`

### Supabase Client Variants
- `lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `lib/supabase/server.ts` — server/API route client (`createServerClient` + Next.js cookies)
- `lib/supabase/admin.ts` — service-role client (bypasses RLS; used only for `nutrition_cache` writes and `meal-photos` Storage operations)

### Profile Robustness
All POST routes that insert into tables with FK to `profiles` include:
```typescript
await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
```
This handles the case where a user signed up before the auto-create trigger was applied.

### Meal Plan JSONB Structure
```json
{
  "2026-07-07": {
    "Breakfast": { "name": "...", "calories": 400, "protein": 30, "carbs": 45, "fat": 10 },
    "Lunch":     { ... },
    "Dinner":    { ... },
    "Snacks":    null
  },
  "2026-07-08": { ... }
}
```

---

## 9. Setup Checklist

1. Create Supabase project → copy URL and keys to `.env.local`
2. Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL editor
3. Create Storage buckets: `recipe-images` (public), `meal-photos` (private)
4. Obtain USDA API key from `api.nal.usda.gov` → add to `.env.local`
5. Add OpenAI API key to `.env.local`
6. Set `NEXT_PUBLIC_APP_URL` in `.env.local` (used for fire-and-forget image generation callback)
7. If users exist pre-migration, run: `INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;`

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Ingredient matching errors corrupt nutrition data | USDA top-result matching; unmatched ingredients produce 0-macro entries (visible to user) |
| USDA API latency/downtime | `nutrition_cache` table avoids repeat calls; cached indefinitely |
| LLM generates malformed plan JSON | Zod schema validation with 2-attempt retry loop; returns 500 with error if both fail |
| Image generation cost | Generated once per recipe, cached in Storage forever |
| Photo portion estimates are inaccurate | Confirmation-first draft UX, per-item confidence flags, macros always from USDA (vision only identifies foods) |
| Missing profile row (FK violations) | Profile upsert guard on all POST routes + setup SQL for pre-migration users |
| Timezone date mismatch | All local date strings use `toLocaleDateString("en-CA")`; ISO strings parsed with `T12:00:00` suffix |
| useEffect infinite fetch loops | Fetch-once flags (`recipesFetched`, `planFetched`) gate all modal data-loading effects |
