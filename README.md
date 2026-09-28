<p align="center">
  <h1>meal-planner-agent</h1>
  <em>An AI-powered meal planning and nutrition tracking app for web and mobile, backed by real food data — not LLM-estimated macros.</em>
</p>

---

## The Strategic "Why"

> Meal planning is a cornerstone of healthy living, but it's often a source of frustration. Users grapple with decision fatigue, dietary restrictions, budget constraints, and the constant struggle to introduce variety. Generic AI tools compound the problem by guessing at nutrition numbers instead of verifying them.

`meal-planner-agent` acts as a personal culinary assistant that generates meal plans and recipes tailored to a user's goals and preferences, then grounds every macro and calorie number in the **USDA FoodData Central** database rather than an LLM's estimate. Users can log meals via photo, free text, USDA search, saved recipes, meal plan, or quick-add, and track progress on dashboards that recalculate automatically as their data changes.

The project ships as a **Next.js web app** and a **native iOS/Android app built with Expo**, both powered by the same backend API routes and the same Supabase database.

---

## Key Features

- 🧠 **AI Meal Planning** — Weekly plans generated from a user's profile macros, with per-meal swap, AI-generated food photos, and an auto-derived grocery list.
- 🍳 **Recipe Generation** — AI drafts ingredients and instructions; every ingredient is matched against USDA data so nutrition totals are verified, not guessed.
- 📷 **Six Ways to Log a Meal** — one-tap from the plan, saved recipe, USDA search, free-text AI parse, photo (vision model), or quick-add — all with a confirmation-first UX.
- 📊 **Progress Dashboards** — daily macro rings, weekly/monthly trend charts, and a weight-vs-intake progress view, all reading from precomputed daily totals.
- ⚖️ **Weight Tracking** — one entry per day with 7-day rolling rate calculation.
- 💬 **Conversational Agent** — a persistent chat surface (floating panel on desktop web, bottom-sheet tab on mobile web, dedicated tab in the native app) that can check remaining macros, look up the plan, swap a meal, or log food by description — every nutrition claim it states comes from a tool call, never from the model's own knowledge.
- 📱 **Native Mobile App** — an Expo (React Native) client with native camera capture for photo logging, secure on-device session storage, and a tab-based layout, sharing the web app's backend and data.

---

## Platforms

| Platform | Location | Stack | Notes |
|---|---|---|---|
| Web | Repo root (`app/`, `components/`, `lib/`) | Next.js 16, React, Tailwind | Also hosts all API routes |
| Mobile (iOS / Android) | [`mobile/`](./mobile) | Expo, React Native, TypeScript | Thin client — calls the Next.js API and Supabase directly |

The web app is the single backend for both clients: all AI orchestration, USDA lookups, and nutrition math live in the Next.js API routes, so the mobile app contains no LLM or nutrition logic of its own.

---

## Technical Architecture

### Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Web framework | Next.js 16 (App Router) | `proxy.ts` replaces `middleware.ts` in Next.js 16 |
| Mobile framework | Expo (React Native) | File-based routing with Expo Router; lives in `mobile/` |
| Language | TypeScript | End-to-end type safety, shared types in `lib/types.ts` |
| UI — web | React + Tailwind CSS | Mobile-responsive; bottom tab bar on small screens |
| UI — mobile | React Native | Native components, bottom tab navigation |
| Database | Supabase (PostgreSQL) | RLS on all user tables; service-role client for `nutrition_cache` writes |
| Auth | Supabase Auth | Email/password; `@supabase/ssr` cookie sessions on web, `expo-secure-store`-backed sessions on mobile |
| AI — text | OpenAI GPT-4o-mini | Recipe generation, meal planning, ingredient parsing, text/photo log parsing |
| AI — images | OpenAI gpt-image-1 | Recipe imagery + meal plan food photos (`quality: "low"` for speed) |
| AI — vision | OpenAI GPT-4o-mini | Photo meal analysis |
| AI orchestration | LangChain + LangGraph | `createReactAgent` for chat, `StateGraph` for plan/recipe pipelines |
| Nutrition data | USDA FoodData Central API | Sole source of truth for calories/protein/carbs/fat |
| Storage | Supabase Storage | `recipe-images` (public), `meal-photos` (private) |
| Charts | Recharts (web) | Dashboard visualizations |
| Hosting | Vercel (web + API) | Native Next.js support; mobile builds via EAS |

### System Overview

```
┌────────────────────┐      ┌────────────────────┐
│  Web (Next.js UI)  │      │  Mobile (Expo app) │
└─────────┬──────────┘      └─────────┬──────────┘
          │  cookie session           │  Bearer token (Supabase JWT)
          └────────────┬──────────────┘
                       ▼
          Next.js API routes  (/api/*)
          ├── LangGraph pipelines + chat agent
          ├── USDA FoodData Central
          └── OpenAI (text, vision, images)
                       ▼
               Supabase (Postgres + Storage + Auth)
```

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
│   ├── onboarding/              # First-login profile setup
│   ├── dashboard/               # Daily / weekly / monthly / progress tabs
│   ├── journal/                 # Food log with date navigation
│   ├── meal-plan/               # Single-day view, macro rings, meal cards + images
│   ├── grocery-list/            # Categorized grocery list
│   ├── recipes/                 # Recipe gallery + generate modal
│   ├── settings/                # Profile edit
│   └── weight/                  # Weight log + chart
├── 📁 components/
│   ├── chat/                    # ChatPanel (SSE streaming, MealConfirmCard)
│   ├── journal/                 # AddMealModal (6-tab log entry)
│   ├── layout/                  # AppShell, Sidebar, MobileNav
│   ├── shared/                  # MacroRingCard, StatsCard, FoodEntryRow, PageHeader
│   └── ui/                      # Card, Button, ProgressBar primitives
├── 📁 lib/
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── nutrition.ts             # TDEE, macro calc, recalcDailyTotals
│   ├── usda.ts                  # USDA search, ingredient matcher, cache writer
│   ├── supabase/                # client / server / admin (service-role)
│   └── langchain/
│       ├── client.ts            # Shared ChatOpenAI singleton
│       ├── tools/               # USDA + chat tool() wrappers
│       ├── graphs/              # planGraph, recipeGraph, chatGraph
│       └── memory/              # SupabaseChatHistory
├── 📁 mobile/                   # Expo (React Native) app — iOS & Android
│   ├── app/                     # Expo Router screens (tabs: plan, journal, dashboard, chat, more)
│   ├── components/              # Native UI components (macro rings, meal cards, chat bubbles)
│   ├── lib/
│   │   ├── api.ts               # Typed fetch wrapper — attaches the Supabase access token
│   │   └── supabase.ts          # Supabase client with SecureStore session persistence
│   ├── app.json                 # Expo config (name, bundle identifiers, permissions)
│   ├── eas.json                 # EAS Build / Submit profiles
│   ├── package.json
│   └── tsconfig.json
├── 📁 supabase/migrations/      # 001_initial_schema.sql, 002_chat_tables.sql
├── 📄 .gitignore
├── 📄 design-doc.md             # Detailed project design and architectural decisions
├── 📄 next.config.ts
├── 📄 package.json
├── 📄 postcss.config.mjs
├── 📄 proxy.ts                  # Auth middleware (Next.js 16) + onboarding gate
└── 📄 tsconfig.json
```

---

## Mobile App (Expo)

The `mobile/` directory contains a native iOS and Android client built with Expo and React Native. It mirrors the web app's core flows — viewing the meal plan, logging meals, tracking weight, viewing dashboards, and chatting with the agent — while using native capabilities where they matter.

### Mobile-Specific Behavior

- **Native photo logging** — the camera / photo library is used to capture a meal, which is uploaded to `/api/log/photo` for vision parsing and USDA matching, followed by the same confirmation-first UX as the web app.
- **Secure sessions** — Supabase sessions are persisted in the device keychain / keystore via `expo-secure-store` instead of browser cookies.
- **Token-based API auth** — the app sends the Supabase access token as an `Authorization: Bearer <token>` header. The API route handlers accept either the web cookie session or a bearer token, so both clients share the same endpoints.
- **Streaming chat** — the chat tab consumes the `/api/chat` SSE stream so agent tokens render as they arrive.
- **No duplicated logic** — nutrition math, USDA matching, and all LLM calls remain server-side. The mobile client only renders results.

### Mobile Prerequisites

- Node.js 18.x or higher
- The web app / API running locally (or deployed)
- [Expo Go](https://expo.dev/go) on a device, **or** an iOS Simulator (Xcode) / Android Emulator (Android Studio)
- For production builds: an [Expo](https://expo.dev) account and the EAS CLI (`npm install -g eas-cli`)

### Mobile Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure environment** — create `mobile/.env`:
   ```ini
   # mobile/.env

   EXPO_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

   # Base URL of the Next.js backend that serves /api/*
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:3000
   ```
   > **Note:** On a physical device or emulator, `localhost` points at the device itself. Use your computer's LAN IP (e.g. `http://192.168.1.20:3000`) for local development, or your deployed Vercel URL. Only `EXPO_PUBLIC_*` variables are bundled into the app — **never** put the service-role key, OpenAI key, or USDA key in `mobile/.env`.

3. **Start the backend** (from the repo root, in a separate terminal):
   ```bash
   npm run dev
   ```

4. **Start the Expo dev server:**
   ```bash
   cd mobile
   npx expo start
   ```
   Then press `i` for the iOS Simulator, `a` for the Android Emulator, or scan the QR code with Expo Go.

### Building for Release

```bash
cd mobile
eas build --platform ios       # or android, or all
eas submit --platform ios      # submit to App Store Connect / Google Play
```

Build profiles (development, preview, production) are defined in `mobile/eas.json`.

---

## API Surface

Both the web and mobile clients call the same routes.

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

Authentication is accepted via the Supabase cookie session (web) or an `Authorization: Bearer` access token (mobile).

Full route-by-route detail lives in [`design-doc.md`](./design-doc.md).

---

## Operational Setup (Web + Backend)

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
   The web application will be accessible at `http://localhost:3000`. To run the mobile app against it, see [Mobile Setup](#mobile-setup).

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
4. **Make your changes**, ensuring they adhere to the project's coding standards. Changes to API routes should be verified against both the web and `mobile/` clients.
5. **Commit your changes** with a clear and concise message: `git commit -m "feat: add new personalized meal generation algorithm"`
6. **Push your branch** to your forked repository: `git push origin feature/your-feature-name`
7. **Open a Pull Request** against the `main` branch, describing your changes in detail.

### License

This project is licensed under the **MIT License**. A copy of the full license text can be found in the `LICENSE.md` file in the root of this repository.

**Permissions:** Commercial use, modification, distribution, and private use are all allowed.
**Conditions:** License and copyright notice must be included with the software.
**Limitations:** Provided "as is," with no warranty of any kind.

---
