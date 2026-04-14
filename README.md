## Ferno Service-app (VIPER & VLS)

Internt verktyg för förebyggande underhåll och servicedokumentation av Ferno VIPER-bårar och VLS-lastsystem.

### 1. Projektstruktur / Project structure

- `app/`
  - `layout.tsx` – global layout, metadata.
  - `(auth)/login/page.tsx` – inloggningssida (Supabase e‑post/lösenord).
  - `(app)/dashboard/page.tsx` – översikt av serviceärenden.
  - `(app)/cases/new/page.tsx` – flerstegsguidad nyservice-formulär.
  - `(app)/cases/[id]/page.tsx` – visning av sparat ärende.
  - `(app)/cases/[id]/edit/page.tsx` – redigera (MVP: placeholder/redirect).
  - `globals.css` – Tailwind-baserad grundstil.
- `components/ui/` – återanvändbara shadcn-liknande UI-komponenter (`button`, `input`, `card`, `badge`, `select`, `textarea`).
- `lib/`
  - `supabaseClient.ts` – klient- och serverinstanser för Supabase.
  - `checklistConfig.ts` – typad konfiguration för VIPER/VLS-checklistorna.
  - `utils.ts` – Tailwind `cn`-helper.
- `middleware.ts` – auth guard (skyddar `/dashboard` och `/cases/**`).
- `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `package.json` – verktygskonfiguration.

### 2. Setup-steg / Setup steps

1. **Installera beroenden / Install dependencies**

   ```bash
   cd Service-app
   npm install
   ```

2. **Miljövariabler / Environment variables**

   Skapa en `.env.local` i projektroten:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=service-photos
   NEXT_PUBLIC_DEMO_EMAIL=demo@ferno.local
   NEXT_PUBLIC_DEMO_PASSWORD=change-me-demo-password
   ```

3. **Supabase-databas / Supabase database schema**

   Kör detta SQL‑skript i Supabase projektets SQL editor:

   ```sql
   create table public.profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     email text unique,
     full_name text,
     created_at timestamptz default now()
   );

   create table public.service_cases (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz default now(),
     updated_at timestamptz default now(),
     created_by uuid references auth.users(id),
     customer_name text,
     location text,
     service_date date,
     technician_name text,
     product_type text,
     viper_serial_number text,
     vls_serial_number text,
     reference_number text,
     final_status text,
     final_comment text,
     is_draft boolean default true
   );

   create table public.service_checklist_items (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz default now(),
     case_id uuid references public.service_cases(id) on delete cascade,
     section_key text,
     item_key text,
     item_label text,
     item_status text,
     comment text,
     part_replaced boolean default false
   );

   create table public.service_parts (
     id uuid primary key default gen_random_uuid(),
     case_id uuid references public.service_cases(id) on delete cascade,
     part_name text,
     part_number text,
     quantity integer default 1,
     note text
   );

   create table public.service_photos (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz default now(),
     case_id uuid references public.service_cases(id) on delete cascade,
     image_url text,
     caption text
   );

   -- Index examples
   create index on public.service_cases (service_date desc);
   create index on public.service_cases (customer_name);
   create index on public.service_cases (product_type);
   ```

   Om du redan har tabellen `service_parts`, kör även detta för reservdelsbehov:

   ```sql
   alter table public.service_parts
   add column if not exists needs_order boolean default false,
   add column if not exists order_status text default 'Ej beställd',
   add column if not exists priority text default 'Medel',
   add column if not exists reason text;

   alter table public.service_cases
   add column if not exists requires_return_visit boolean default false;
   ```

4. **Auth‑inställningar / Auth settings**

   - Aktivera **Email/password** i Supabase Authentication.
   - Skapa tekniker-konton via Supabase Dashboard (Authentication → Users).
   - För testkonto: skapa en separat användare i Supabase Users med samma e-post/lösenord som `NEXT_PUBLIC_DEMO_EMAIL` och `NEXT_PUBLIC_DEMO_PASSWORD`.

5. **Utvecklingsserver / Dev server**

   ```bash
   npm run dev
   # öppna http://localhost:3000/login
   ```

6. **Supabase Storage för kamera / Supabase Storage for camera**

   - Skapa en bucket i Supabase Storage, t.ex. `service-photos`.
   - Sätt bucket till public för enkel MVP-visning av bilder.
   - Lägg till env-variabeln `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=service-photos`.

### 3. Koppla Supabase / Connect Supabase

- Sätt `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY` som du hittar i Supabase‑projektets **Project Settings → API**.
- `lib/supabaseClient.ts` skapar:
  - `createClientSupabaseBrowser()` – används i klientkomponenter (t.ex. login och skapa ärende).
  - `createClientSupabaseServer(cookies)` – används i serverkomponenter (t.ex. dashboard, visning av ärende).
- `middleware.ts` använder `@supabase/auth-helpers-nextjs` för att läsa session från cookies och:
  - omdirigera icke-inloggade användare från `/dashboard` och `/cases/**` till `/login`.
  - undvika att inloggade användare ser `/login` igen.

### 4. Deploy till Vercel / Deploy to Vercel

1. Skapa ett nytt projekt på Vercel och peka det mot ditt Git-repo med denna kod.
2. I Vercel-projektets **Settings → Environment Variables**, lägg till:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Deploya projektet. Vercel bygger automatiskt Next.js 14 app‑router appen.
4. Sätt Supabase `SITE_URL` (Auth settings) till din Vercel‑URL för korrekta redirect‑URIs.

### 5. Nästa steg efter MVP / What to build next

- **Fullständig redigering av ärenden**: Återanvänd `cases/new`‑flödet för `/cases/[id]/edit` (förifyll formuläret och spara uppdateringar).
- **Bilduppladdning**: Koppla steg 3 till Supabase Storage med direktuppladdning från mobilkamera.
- **Bättre checklist‑metadata**: Lägg till tabell för statisk checklistkonfiguration och referera från `service_checklist_items`.
- **PDF‑export**: Generera snygg PDF‑rapport för kunden (t.ex. via serverless‑funktion).
- **Roller och behörighet**: Lägg till enkla roller (tekniker, admin) och begränsa t.ex. borttagning av ärenden till admin.

