-- ====================================================
-- 짤랑짤랑 - Supabase 데이터베이스 설정 SQL
-- Supabase > SQL Editor 에 이 내용을 붙여넣고 실행하세요!
-- ====================================================

-- 1. 통화 테이블
create table if not exists currencies (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  code text not null,
  created_at timestamptz default now()
);

-- 2. 자산 테이블
create table if not exists assets (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  currency_code text not null,
  asset_type text not null default 'liquid', -- 'liquid' or 'credit'
  balance double precision default 0,
  created_at timestamptz default now()
);

-- 3. 결제 수단 테이블
create table if not exists payment_methods (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  linked_asset_id bigint references assets(id) on delete set null,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

-- 4. 카테고리 테이블
create table if not exists category_items (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'income' or 'expense'
  name text not null,
  created_at timestamptz default now()
);

-- 5. 거래 내역 테이블
create table if not exists records (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'income', 'expense', 'transfer'
  amount double precision not null,
  date date not null,
  category text not null,
  currency_code text not null,
  asset_id bigint references assets(id) on delete set null,
  to_asset_id bigint references assets(id) on delete set null,
  payment_method_id bigint references payment_methods(id) on delete set null,
  memo text,
  created_at timestamptz default now()
);

-- ====================================================
-- Row Level Security (본인 데이터만 접근 가능하게!)
-- ====================================================
alter table currencies enable row level security;
alter table assets enable row level security;
alter table payment_methods enable row level security;
alter table category_items enable row level security;
alter table records enable row level security;

-- 각 테이블: 본인 것만 읽기/쓰기/수정/삭제 가능
create policy "currencies_own" on currencies for all using (auth.uid() = user_id);
create policy "assets_own" on assets for all using (auth.uid() = user_id);
create policy "payment_methods_own" on payment_methods for all using (auth.uid() = user_id);
create policy "category_items_own" on category_items for all using (auth.uid() = user_id);
create policy "records_own" on records for all using (auth.uid() = user_id);

-- ====================================================
-- 신규 가입자 기본 데이터 자동 생성 함수
-- (가입하면 KRW 통화 + 기본 카테고리 자동으로 생김!)
-- ====================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- 기본 통화
  insert into currencies (user_id, code) values (new.id, 'KRW');

  -- 기본 지출 카테고리
  insert into category_items (user_id, type, name) values
    (new.id, 'expense', '식비'),
    (new.id, 'expense', '생활비'),
    (new.id, 'expense', '고정비'),
    (new.id, 'expense', '교통비'),
    (new.id, 'expense', '통신비'),
    (new.id, 'expense', '쇼핑비'),
    (new.id, 'expense', '의료비'),
    (new.id, 'expense', '여행비'),
    (new.id, 'expense', '기타');

  -- 기본 수입 카테고리
  insert into category_items (user_id, type, name) values
    (new.id, 'income', '월급'),
    (new.id, 'income', '부수입'),
    (new.id, 'income', '용돈'),
    (new.id, 'income', '보너스'),
    (new.id, 'income', '기타');

  return new;
end;
$$ language plpgsql security definer;

-- 가입 시 자동 실행
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
