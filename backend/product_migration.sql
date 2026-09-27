-- Additive DORI product migration. This does not drop or rebuild existing data.
-- Run after profile_migration.sql and the existing DORI schema migration.

-- The application has its own custom_users/JWT identity rather than Supabase Auth.
-- Drop the legacy Supabase Auth FK so custom account UUIDs can own profiles.
create table if not exists custom_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  is_verified boolean not null default false,
  otp_code text,
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0 check (otp_attempts >= 0),
  created_at timestamptz not null default now()
);
alter table custom_users add column if not exists otp_attempts integer not null default 0;
alter table custom_users enable row level security;

alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles add column if not exists skills jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists location text;
alter table profiles add column if not exists phone_number text;
alter table profiles add column if not exists phone_visible_to_order_partners boolean not null default false;
alter table profiles add column if not exists latitude double precision;
alter table profiles add column if not exists longitude double precision;
alter table profiles add column if not exists is_moderator boolean not null default false;
alter table profiles add column if not exists updated_at timestamptz not null default now();

alter table tailors add column if not exists profile_id uuid references profiles(id) on delete set null;
create unique index if not exists tailors_profile_id_unique on tailors(profile_id) where profile_id is not null;

alter table posts add column if not exists profile_id uuid references profiles(id) on delete set null;
alter table posts add column if not exists caption text not null default '';
alter table posts add column if not exists garment_type text not null default 'custom';
alter table posts add column if not exists visibility text not null default 'public';
alter table posts add column if not exists starting_price_minor bigint not null default 0 check (starting_price_minor >= 0);
alter table posts add column if not exists currency char(3) not null default 'INR';
alter table remixes add column if not exists profile_id uuid references profiles(id) on delete set null;
create index if not exists posts_tailor_created_idx on posts(tailor_id, created_at desc);
create index if not exists posts_profile_created_idx on posts(profile_id, created_at desc);

create table if not exists follows (
  follower_profile_id uuid not null references profiles(id) on delete cascade,
  followed_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_profile_id, followed_profile_id),
  check (follower_profile_id <> followed_profile_id)
);
-- If `follows` was originally created by the older migrate_social.py script
-- (follower_id/following_id, referencing custom_users), the block above is a
-- no-op and the app's queries for follower_profile_id/followed_profile_id
-- fail outright. This safely renames the old columns in place if present.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'follows' and column_name = 'follower_id')
     and not exists (select 1 from information_schema.columns where table_name = 'follows' and column_name = 'follower_profile_id') then
    alter table follows rename column follower_id to follower_profile_id;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'follows' and column_name = 'following_id')
     and not exists (select 1 from information_schema.columns where table_name = 'follows' and column_name = 'followed_profile_id') then
    alter table follows rename column following_id to followed_profile_id;
  end if;
end $$;

create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, profile_id)
);
create index if not exists post_likes_post_idx on post_likes(post_id);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references post_comments(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_created_idx on post_comments(post_id, created_at);

create table if not exists garment_types (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category text not null check (category in ('upper_body','lower_body','full_body','accessory','custom')),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(profile_id, name)
);
-- Lets a tailor pick one of their own posts as the reference photo for a shop garment type.
alter table garment_types add column if not exists image_url text;
alter table garment_types add column if not exists post_id text references posts(id) on delete set null;

create table if not exists fabrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  composition text not null default '',
  color text not null default '',
  image_url text,
  price_delta_minor bigint not null default 0 check (price_delta_minor >= 0),
  currency char(3) not null default 'INR',
  available_quantity integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, name)
);

create table if not exists post_fabrics (
  post_id text not null references posts(id) on delete cascade,
  fabric_id uuid not null references fabrics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, fabric_id)
);

create table if not exists measurement_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  fit_template text not null check (fit_template in ('womens','mens','custom')),
  unit text not null check (unit in ('cm','in')),
  measurements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists measurement_profiles_owner_idx on measurement_profiles(profile_id);

alter table orders add column if not exists customer_profile_id uuid references profiles(id) on delete set null;
alter table orders add column if not exists currency char(3) not null default 'INR';
alter table orders add column if not exists quoted_total_minor bigint check (quoted_total_minor is null or quoted_total_minor >= 0);
alter table orders add column if not exists spec_snapshot jsonb not null default '{}'::jsonb;
alter table orders add column if not exists customer_note text not null default '';
alter table orders add column if not exists updated_at timestamptz not null default now();
create index if not exists orders_customer_created_idx on orders(customer_profile_id, created_at desc);
create index if not exists orders_tailor_status_idx on orders(tailor_id, status, created_at desc);

create table if not exists order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  revision integer not null,
  proposed_by_profile_id uuid not null references profiles(id),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  estimated_days integer check (estimated_days is null or estimated_days > 0),
  message text not null default '',
  status text not null default 'proposed' check (status in ('proposed','accepted','rejected','superseded','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, revision)
);

create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  sender_profile_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  quote_id uuid references order_quotes(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_created_idx on order_messages(order_id, created_at);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  provider text not null,
  provider_session_id text,
  provider_payment_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  status text not null check (status in ('created','pending','paid','failed','refunded')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tailor_payment_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  tailor_id text not null unique references tailors(id) on delete cascade,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  key_id text not null,
  encrypted_key_secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table tailor_payment_settings enable row level security;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_owner_created_idx on notifications(profile_id, created_at desc);

create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid unique references notifications(id) on delete cascade,
  recipient_email text,
  subject text,
  body text,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);
create unique index if not exists notification_outbox_notification_unique on notification_outbox(notification_id);

-- New tables are server-accessed with the service role; never expose the service key to the browser.
alter table follows enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;
alter table garment_types enable row level security;
alter table fabrics enable row level security;
alter table post_fabrics enable row level security;
alter table measurement_profiles enable row level security;
alter table order_quotes enable row level security;
alter table order_messages enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table notification_outbox enable row level security;
