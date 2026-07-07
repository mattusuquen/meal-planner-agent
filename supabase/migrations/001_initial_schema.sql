-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  goal text check (goal in ('lose', 'maintain', 'gain')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  height_cm numeric,
  birth_date date,
  sex text check (sex in ('male', 'female')),
  calorie_target int,
  protein_g int,
  carbs_g int,
  fat_g int,
  dietary_restrictions text[] default '{}',
  allergies text[] default '{}',
  dislikes text[] default '{}',
  cuisines text[] default '{}',
  meal_structure text default '3_plus_snacks',
  display_name text,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- NUTRITION CACHE (USDA FoodData Central — public read)
-- ============================================================
create table if not exists nutrition_cache (
  usda_fdc_id int primary key,
  description text not null,
  per_100g jsonb not null, -- { calories, protein_g, carbs_g, fat_g }
  fetched_at timestamptz default now()
);

-- ============================================================
-- RECIPES
-- ============================================================
create table if not exists recipes (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid references profiles on delete cascade,
  name text not null,
  instructions jsonb, -- array of step strings
  servings int default 1,
  image_url text,
  source text check (source in ('ai', 'user')) default 'ai',
  cuisine text,
  prep_minutes int,
  -- denormalized verified totals per serving:
  calories numeric default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- RECIPE INGREDIENTS
-- ============================================================
create table if not exists recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes on delete cascade,
  usda_fdc_id int references nutrition_cache(usda_fdc_id),
  raw_text text,
  quantity numeric,
  unit text,
  grams numeric
);

-- ============================================================
-- MEAL PLANS
-- ============================================================
create table if not exists meal_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles on delete cascade,
  week_start date not null,
  plan jsonb not null default '{}',
  status text default 'active',
  created_at timestamptz default now()
);

-- ============================================================
-- LOGGED MEALS
-- ============================================================
create table if not exists logged_meals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles on delete cascade,
  logged_date date not null,
  recipe_id uuid references recipes,
  custom_entry jsonb, -- { name, calories, protein_g, carbs_g, fat_g }
  servings numeric default 1,
  meal_slot text check (meal_slot in ('Breakfast', 'Lunch', 'Dinner', 'Snacks')),
  entry_method text check (entry_method in ('plan', 'recipe', 'search', 'text', 'photo', 'quick')),
  photo_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- DAILY TOTALS (denormalized for fast dashboard reads)
-- ============================================================
create table if not exists daily_totals (
  user_id uuid references profiles on delete cascade,
  date date not null,
  calories numeric default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  meals_logged int default 0,
  primary key (user_id, date)
);

-- ============================================================
-- WEIGHT ENTRIES
-- ============================================================
create table if not exists weight_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles on delete cascade,
  entry_date date not null,
  weight_kg numeric not null,
  created_at timestamptz default now(),
  unique (user_id, entry_date)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- nutrition_cache (public read, service-role write)
alter table nutrition_cache enable row level security;
create policy "Anyone can read nutrition cache" on nutrition_cache for select using (true);
create policy "Service role can insert nutrition cache" on nutrition_cache for insert with check (true);
create policy "Service role can update nutrition cache" on nutrition_cache for update using (true);

-- recipes
alter table recipes enable row level security;
create policy "Users can manage own recipes" on recipes for all using (auth.uid() = created_by);

-- recipe_ingredients
alter table recipe_ingredients enable row level security;
create policy "Users can manage ingredients of own recipes" on recipe_ingredients
  for all using (
    exists (
      select 1 from recipes
      where recipes.id = recipe_id
        and recipes.created_by = auth.uid()
    )
  );

-- meal_plans
alter table meal_plans enable row level security;
create policy "Users can manage own plans" on meal_plans for all using (auth.uid() = user_id);

-- logged_meals
alter table logged_meals enable row level security;
create policy "Users can manage own logs" on logged_meals for all using (auth.uid() = user_id);

-- daily_totals
alter table daily_totals enable row level security;
create policy "Users can manage own totals" on daily_totals for all using (auth.uid() = user_id);

-- weight_entries
alter table weight_entries enable row level security;
create policy "Users can manage own weight" on weight_entries for all using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
