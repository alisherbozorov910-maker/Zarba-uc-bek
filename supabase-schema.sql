-- ZARBA.UC uchun jadvallar
-- Buni Supabase loyihangizda: SQL Editor -> New query -> shu matnni joylashtiring -> Run

create table if not exists packages (
  id text primary key,
  uc integer not null,
  price integer not null,
  popular boolean default false,
  active boolean default true
);

create table if not exists orders (
  id text primary key,
  uc integer not null,
  price integer not null,
  pubg_id text not null,
  phone text not null,
  payment text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- Xavfsizlikni yoqamiz, lekin sayt (anon kalit) o'qish/yozishga ruxsat beramiz.
-- Eslatma: bu demo/kichik loyiha uchun soddalashtirilgan sozlama - har kim
-- anon kalit orqali yozishi mumkin. Jiddiy loyihada bu qoidalarni server
-- tomonidagi tekshiruvlar (masalan Supabase Edge Functions) bilan qattiqlashtirish kerak.

alter table packages enable row level security;
alter table orders enable row level security;

create policy "packages_select" on packages for select using (true);
create policy "packages_insert" on packages for insert with check (true);
create policy "packages_update" on packages for update using (true);
create policy "packages_delete" on packages for delete using (true);

create policy "orders_select" on orders for select using (true);
create policy "orders_insert" on orders for insert with check (true);
create policy "orders_update" on orders for update using (true);

-- Real vaqtda yangilanish uchun (admin panel darhol yangi buyurtmani ko'rishi uchun)
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table packages;
