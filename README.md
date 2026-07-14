<p align="center">
  <h1>meal-planner-agent</h1>
  <em>An AI-powered meal planning and nutrition tracking app, backed by real food data — not LLM-estimated macros.</em>
</p>

---

## The Strategic "Why"

> Meal planning is a cornerstone of healthy living, but it's often a source of frustration. Users grapple with decision fatigue, dietary restrictions, budget constraints, and the constant struggle to introduce variety. Generic AI tools compound the problem by guessing at nutrition numbers instead of verifying them.

`meal-planner-agent` acts as a personal culinary assistant that generates meal plans and recipes tailored to a user's goals and preferences, then grounds every macro and calorie number in the **USDA FoodData Central** database rather than an LLM's estimate. Users can log meals via photo, free text, USDA search, saved recipes, meal plan, or quick-add, and track progress on dashboards that recalculate automatically as their data changes.

---

## Key Features

- 🧠 **AI Meal Planning** — Weekly plans generated from a user's profile macros, with per-meal swap, AI-generated food photos, and an auto-derived grocery list.
- 🍳 **Recipe Generation** — AI drafts ingredients and instructions; every ingredient is matched against USDA data so nutrition totals are verified, not guessed.
- 📷 **Six Ways to Log a Meal** — one-tap from the plan, saved recipe, USDA search, free-text AI parse, photo (vision model), or quick-add — all with a confirmation-first UX.
- 📊 **Progress Dashboards** — daily macro rings, weekly/monthly trend charts, and a weight-vs-intake progress view, all reading from precomputed daily totals.
- ⚖️ **Weight Tracking** — one entry per day with 7-day rolling rate calculation.
- 💬 **Conversational Agent** — a persistent chat surface (floating panel on desktop, bottom-sheet tab on mobile) that can check remaining macros, look up the plan, swap a meal, or log food by description — every nutrition claim it states comes from a tool call, never from the model's own knowledge.

---

## Technical Architecture

### Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | `proxy.ts` replaces `middleware.ts` in Next.js 16 |
| Language | TypeScript | End-to-end type safety, shared types in `lib/types.ts` |
| UI | React + Tailwind CSS | Mobile-responsive; bottom tab bar on mobile |
| Database | Supabase (PostgreSQL) | RLS on all user tables; service-role client for `nutrition_cache` writes |
| Auth | Supabase Auth | Email/password; `@supabase/ssr` cookie-based sessions |
| AI — text | OpenAI GPT-4o-mini | Recipe generation, meal planning, ingredient parsing, text/photo log parsing |
| AI — images | OpenAI gpt-image-1 | Recipe imagery + meal plan food photos (`quality: "low"` for speed) |
| AI — vision | OpenAI GPT-4o-mini | Photo meal analysis |
| AI orchestration | LangChain + LangGraph | `createReactAgent` for chat, `StateGraph` for plan/recipe pipelines |
| Nutrition data | USDA FoodData Central API | Sole source of truth for calories/protein/carbs/fat |
| Storage | Supabase Storage | `recipe-images` (public), `meal-photos` (private) |
| Charts | Recharts | Dashboard visualizations |
| Hosting | Vercel | Native Next.js support |

### AI Agent Architecture

```
User request → Next.js API route handler
  ├── Plan generation:   LangGraph StateGraph — generatePlan → validatePlan (retry ≤1) → savePlan
  ├── Meal swap:         GPT-4o-mini direct call, remaining daily budget passed as context
  ├── Recipe generation: LangGraph StateGraph — generateRecipe → lookupNutrition → calculateMacros → saveRecipe → generateImage
  ├── Chat agent:        LangGraph createReactAgent — tool-calling loop, SSE-streamed tokens
  │     tools: get_daily_totals, get_meal_plan, swap_meal, parse_and_log_meal, confirm_log_meal
  ├── Text/Photo parse:  GPT-4o-mini (text or vision) → structured items → USDA match
  ├── Ingredient matcher: USDA /foods/search → top result → cached in nutrition_cache
  └── Nutrition calc:    Pure TS functions in lib/nutrition.ts — no LLM involvement
```

The core guarantee holds throughout: the LLM supplies ingredient names and structure, but macro numbers always come from USDA-verified data, never from the model's own estimate.

### Directory Structure

```
meal-planner-agent/
├── 📁 app/                      # Next.js App Router — pages + API routes
│   ├── api/                     # plan, recipes, log, dashboard, weight, chat, usda
│   ├── auth/                    # login, signup, callback
│   ├── onboarding/               # First-login profile setup
│   ├── dashboard/                # Daily / weekly / monthly / progress tabs
│   ├── journal/                  # Food log with date navigation
│   ├── meal-plan/                # Single-day view, macro rings, meal cards + images
│   ├── grocery-list/             # Categorized grocery list
│   ├── recipes/                  # Recipe gallery + generate modal
│   ├── settings/                 # Profile edit
│   └── weight/                   # Weight log + chart
├── 📁 components/
│   ├── chat/                    # ChatPanel (SSE streaming, MealConfirmCard)
│   ├── journal/                  # AddMealModal (6-tab log entry)
│   ├── layout/                   # AppShell, Sidebar, MobileNav
│   ├── shared/                   # MacroRingCard, StatsCard, FoodEntryRow, PageHeader
│   └── ui/                       # Card, Button, ProgressBar primitives
├── 📁 lib/
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── nutrition.ts               # TDEE, macro calc, recalcDailyTotals
│   ├── usda.ts                    # USDA search, ingredient matcher, cache writer
│   ├── supabase/                  # client / server / admin (service-role)
│   └── langchain/
│       ├── client.ts             # Shared ChatOpenAI singleton
│       ├── tools/                 # USDA + chat tool() wrappers
│       ├── graphs/                # planGraph, recipeGraph, chatGraph
│       └── memory/                # SupabaseChatHistory
├── 📁 supabase/migrations/       # 001_initial_schema.sql, 002_chat_tables.sql
├── 📄 .gitignore
├── 📄 design-doc.md              # Detailed project design and architectural decisions
├── 📄 next.config.ts
├── 📄 package.json
├── 📄 postcss.config.mjs
├── 📄 proxy.ts                   # Auth middleware (Next.js 16) + onboarding gate
└── 📄 tsconfig.json
```

---

## API Surface

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/plan?week_start=` | Fetch active plan for week |
| POST | `/api/plan/generate` | Generate 7-day plan via LangGraph |
| POST | `/api/plan/swap-meal` | Replace one meal slot within daily budget |
| POST | `/api/plan/meal-image` | Generate and cache a gpt-image-1 photo for a meal slot |
| POST | `/api/grocery/generate` | Aggregate plan ingredients into a categorized list |
| GET | `/api/profile` | Fetch authenticated user's profile |
| GET/POST | `/api/recipes`, `/api/recipes/generate` | List / AI-generate recipes (USDA-matched) |
| GET/POST | `/api/recipes/[id]/image` | Generate and poll for a recipe image |
| GET/POST/DELETE | `/api/log` | Fetch, log, or delete a meal entry |
| POST | `/api/log/photo`, `/api/log/text` | Photo or free-text → structured, USDA-matched draft |
| GET | `/api/usda/search?q=` | Proxy USDA food search |
| GET | `/api/dashboard/daily`, `/api/dashboard/trends` | Daily and trend data for dashboards |
| GET/POST/DELETE | `/api/weight` | Weight entries |
| POST | `/api/chat` | Send a message; stream agent response via SSE |
| GET | `/api/chat/sessions`, `/api/chat/sessions/[id]` | List / fetch chat sessions |

Full route-by-route detail lives in [`design-doc.md`](./design-doc.md).

---

## Operational Setup

### Prerequisites

- **Node.js**: Version 18.x or higher (LTS recommended)
- **npm**, **yarn**, or **pnpm**
- A Supabase project
- An OpenAI API key with access to `gpt-4o-mini` and `gpt-image-1`
- A free USDA FoodData Central API key ([api.nal.usda.gov](https://api.nal.usda.gov))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mattusuquen/meal-planner-agent.git
   cd meal-planner-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or yarn install
   # or pnpm install
   ```

3. **Set up Supabase:**
   - Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
   - Run `supabase/migrations/002_chat_tables.sql` (adds `chat_sessions` + `chat_messages`).
   - Create two Storage buckets: `recipe-images` (public) and `meal-photos` (private).
   - If any users existed before the migration trigger, backfill their profile rows:
     ```sql
     INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;
     ```

4. **Run the development server:**
   ```bash
   npm run dev
   # or yarn dev
   # or pnpm dev
   ```
   The application will be accessible at `http://localhost:3000`.

### Environment Configuration

Create a `.env.local` file in the project root:

```ini
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# OpenAI
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# USDA FoodData Central
USDA_API_KEY=YOUR_USDA_API_KEY
```

> **Note:** `next.config.ts` must include `serverExternalPackages: ["@langchain/core", "@langchain/langgraph", "@langchain/openai"]` to prevent ESM bundling conflicts with LangChain.

---

## Community & Governance

### Contributing

1. **Fork** the repository.
2. **Clone** your forked repository to your local machine.
3. **Create a new branch** for your feature or bug fix: `git checkout -b feature/your-feature-name` or `bugfix/issue-description`.
4. **Make your changes**, ensuring they adhere to the project's coding standards.
5. **Commit your changes** with a clear and concise message: `git commit -m "feat: add new personalized meal generation algorithm"`
6. **Push your branch** to your forked repository: `git push origin feature/your-feature-name`
7. **Open a Pull Request** against the `main` branch, describing your changes in detail.

### License

This project is licensed under the **MIT License**. A copy of the full license text can be found in the `LICENSE.md` file in the root of this repository.

**Permissions:** Commercial use, modification, distribution, and private use are all allowed.
**Conditions:** License and copyright notice must be included with the software.
**Limitations:** Provided "as is," with no warranty of any kind.

---
