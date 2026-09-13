-- ZARBA.UC — hisob, balans, hisob to'ldirish, yordam bo'limi
-- Supabase loyihangizda: SQL Editor -> New query -> shu faylni to'liq joylashtiring -> Run
-- Eslatma: bu supabase-schema.sql dan KEYIN ishga tushiriladi (u orders/packages jadvallarini yaratadi)

-- 1) Har bir foydalanuvchi uchun profil va balans
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  balance integer not null default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "profiles_all" on profiles for all using (true) with check (true);

-- Yangi ro'yxatdan o'tgan foydalanuvchiga avtomatik profil (balans = 0) yaratish
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone, balance)
  values (new.id, new.raw_user_meta_data->>'phone', 0);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2) Admin karta raqami sozlamalari
create table if not exists settings (
  id int primary key default 1,
  card_number text default '',
  card_owner text default ''
);
insert into settings (id, card_number, card_owner) values (1, '', '') on conflict (id) do nothing;

alter table settings enable row level security;
create policy "settings_all" on settings for all using (true) with check (true);

-- 3) Hisob to'ldirish so'rovlari (chek bilan)
create table if not exists topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  phone text,
  amount integer not null,
  receipt_url text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table topup_requests enable row level security;
create policy "topup_all" on topup_requests for all using (true) with check (true);

-- Chek suratlari uchun ombor (storage bucket)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "receipts_insert" on storage.objects;
drop policy if exists "receipts_select" on storage.objects;
create policy "receipts_insert" on storage.objects for insert with check (bucket_id = 'receipts');
create policy "receipts_select" on storage.objects for select using (bucket_id = 'receipts');

-- 4) Yordam (support) xabarlari
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  phone text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz default now()
);

alter table support_messages enable row level security;
create policy "support_all" on support_messages for all using (true) with check (true);

-- 5) Telegram orqali admin ga aniq vaqti bilan xabar yuborish
-- BOT_TOKEN va CHAT_ID ni pastda o'z qiymatlaringiz bilan almashtiring, so'ng shu faylni qayta ishga tushiring.

create extension if not exists pg_net;

create or replace function notify_telegram(msg text)
returns void as $$
declare
  bot_token text := '8874133265:AAFyruQl0OKPKoxBF24WbGhrRXH47oFoMco';
  chat_id text := '8973435388';
begin
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', chat_id, 'text', msg)
  );
end;
$$ language plpgsql security definer;

create or replace function notify_telegram_topup()
returns trigger as $$
begin
  perform notify_telegram(
    '💰 Yangi hisob to''ldirish so''rovi' || E'\n' ||
    'Summa: ' || NEW.amount || ' so''m' || E'\n' ||
    'Telefon: ' || coalesce(NEW.phone, '-') || E'\n' ||
    'Vaqt: ' || to_char(NEW.created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_topup_insert on topup_requests;
create trigger on_topup_insert
after insert on topup_requests
for each row execute function notify_telegram_topup();

create or replace function notify_telegram_support()
returns trigger as $$
begin
  perform notify_telegram(
    '✉️ Yangi yordam xabari' || E'\n' ||
    'Telefon: ' || coalesce(NEW.phone, '-') || E'\n' ||
    'Xabar: ' || NEW.message || E'\n' ||
    'Vaqt: ' || to_char(NEW.created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_support_insert on support_messages;
create trigger on_support_insert
after insert on support_messages
for each row execute function notify_telegram_support();

-- Yangi buyurtma kelganda ham xabar kelsin
create or replace function notify_telegram_order()
returns trigger as $$
begin
  perform notify_telegram(
    '🛒 Yangi buyurtma' || E'\n' ||
    'ID: ' || NEW.id || E'\n' ||
    'UC: ' || NEW.uc || E'\n' ||
    'Narx: ' || NEW.price || ' so''m' || E'\n' ||
    'Telefon: ' || coalesce(NEW.phone, '-') || E'\n' ||
    'To''lov: ' || NEW.payment || E'\n' ||
    'Vaqt: ' || to_char(NEW.created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_order_insert on orders;
create trigger on_order_insert
after insert on orders
for each row execute function notify_telegram_order();
