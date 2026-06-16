-- Dataverse AI Interview Coach — database schema (PRD §9).
-- Idempotent: safe to run multiple times. Run via `python -m db.migrate`.
-- Supabase provides auth.users; app rows key off that user's UUID.

create extension if not exists vector;     -- pgvector (future semantic RAG)
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- App profile mirror of an auth user (+ admin flag).
create table if not exists public.profiles (
    id          uuid primary key,                       -- == auth.users.id
    email       text,
    is_admin    boolean not null default false,
    created_at  timestamptz not null default now()
);

-- Credits: 1 interview session = 1 credit (PRD §8).
create table if not exists public.credits (
    user_id     uuid primary key references public.profiles(id) on delete cascade,
    balance     integer not null default 3              -- free starter credits
);

-- Interview sessions.
create table if not exists public.sessions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references public.profiles(id) on delete cascade,
    config      jsonb not null,                         -- role/industry/level/scale/persona/type/difficulty/mode
    stage       integer not null default 1,
    status      text not null default 'active',         -- active | completed | abandoned
    report      jsonb,                                  -- SessionReport at close
    started_at  timestamptz not null default now(),
    ended_at    timestamptz
);
create index if not exists sessions_user_idx on public.sessions(user_id, started_at desc);

-- Transcript messages.
create table if not exists public.messages (
    id          uuid primary key default gen_random_uuid(),
    session_id  uuid references public.sessions(id) on delete cascade,
    sender      text not null,                          -- interviewer | candidate
    stage       integer not null,
    lens        text,
    content     text not null,
    kind        text not null default 'turn',           -- turn | question | answer | ask | clarify
    created_at  timestamptz not null default now()
);
create index if not exists messages_session_idx on public.messages(session_id, created_at);

-- Per-answer evaluations (Evaluation Engine, PRD §5).
create table if not exists public.evaluations (
    id              uuid primary key default gen_random_uuid(),
    message_id      uuid references public.messages(id) on delete cascade,
    session_id      uuid references public.sessions(id) on delete cascade,
    scores          jsonb not null,                     -- 8 dimensions
    principles      jsonb not null,                     -- 6 Elite Principles hit/miss
    confidence      integer not null default 0,         -- 0..100
    stronger_answer text,
    missed_concepts jsonb,
    star_notes      text,
    to_improve      text,
    created_at      timestamptz not null default now()
);
create index if not exists evaluations_session_idx on public.evaluations(session_id);

-- Idempotent column adds for databases created before these columns existed.
alter table public.messages     add column if not exists kind text not null default 'turn';
alter table public.evaluations  add column if not exists to_improve text;

-- Knowledge base (schema-reserved; V1 RAG runs from local JSONL, M-future moves it here).
create table if not exists public.documents (
    id              uuid primary key default gen_random_uuid(),
    layer           text,
    company         text,
    industry        text,
    role_level      text,
    interview_type  jsonb,
    competencies    jsonb,
    answer_quality  text,
    lens            text,
    anonymized      boolean default true,
    title           text,
    source          text,
    created_at      timestamptz not null default now()
);

create table if not exists public.doc_chunks (
    id          uuid primary key default gen_random_uuid(),
    document_id uuid references public.documents(id) on delete cascade,
    content     text not null,
    embedding   vector(384),                            -- BAAI/bge-small-en-v1.5 dimension
    metadata    jsonb
);
