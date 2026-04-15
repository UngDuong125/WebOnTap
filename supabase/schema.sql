-- Supabase schema for Quiz Master (Admin Driven)

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  role text not null default 'user',
  math_exp int not null default 0,
  lang_exp int not null default 0,
  flang_exp int not null default 0,
  sci_exp int not null default 0,
  hist_geo_exp int not null default 0,
  civic_exp int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quizzes (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid references users(id) on delete set null,
  tag text not null,
  quiz_title text not null,
  question_count int not null default 0,
  display_count int not null default 0,
  category_display_counts jsonb not null default '{}'::jsonb,
  questions jsonb not null,
  target_user_ids jsonb not null default '[]'::jsonb,
  is_global boolean not null default true,
  high_score int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

INSERT INTO users (username, role)
VALUES 
  ('ungduong', 'admin'),
  ('uthhai', 'user'),
  ('cthtrang', 'user'),
  ('uvathanh', 'user'),
  ('cthmy', 'user');

