-- Apply once in Supabase SQL editor. The implemented provider uses app_cache.
-- Normalised tables provide an indexed ingestion/research store through the RPC below.
create table if not exists public.app_cache (
 key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.companies (
 ticker text primary key, name text not null, sector text, exchange text not null default 'NSE'
);
create table if not exists public.portfolio_membership (
 workspace_id uuid not null, ticker text not null references public.companies, added_at timestamptz not null default now(), primary key(workspace_id,ticker)
);
create table if not exists public.daily_prices (
 ticker text not null references public.companies, session_at timestamptz not null, close numeric not null check(close>0), volume bigint not null check(volume>=0), source_url text not null, ingested_at timestamptz not null, primary key(ticker,session_at)
);
create table if not exists public.announcements (
 id text primary key,ticker text not null references public.companies,published_at timestamptz not null,title text not null,description text,category text not null,priority integer check(priority between 0 and 100),source_url text not null,attachment_url text,classification_method text,confidence numeric check(confidence between 0 and 1),ingested_at timestamptz not null,raw_record jsonb not null
);
create index if not exists announcements_ticker_date on public.announcements(ticker,published_at desc);
create index if not exists announcements_priority_date on public.announcements(priority desc,published_at desc);
create table if not exists public.source_documents (
 id text primary key,ticker text not null references public.companies,title text not null,kind text,period text,url text not null,sha256 text not null,retrieved_at timestamptz not null,unique(ticker,sha256)
);
create table if not exists public.document_chunks (
 id bigint generated always as identity primary key,document_id text not null references public.source_documents on delete cascade,page integer not null check(page>0),content text not null,search_vector tsvector generated always as(to_tsvector('english',content)) stored,unique(document_id,page)
);
create index if not exists document_chunks_search on public.document_chunks using gin(search_vector);
create table if not exists public.financial_facts (
 id bigint generated always as identity primary key,ticker text references public.companies,document_id text references public.source_documents,page integer,metric text not null,period text not null,basis text not null,currency text not null,unit text not null,value numeric not null,unique(document_id,metric,period,basis)
);
create table if not exists public.research_insights (
 cache_key text primary key,ticker text references public.companies,source_revision text not null,query text,output jsonb not null,created_at timestamptz default now()
);
create table if not exists public.management_statements (
 id text primary key,ticker text references public.companies,statement text not null,statement_at date,metric text,target_low numeric,target_high numeric,target_period text,document_id text references public.source_documents,page integer
);
create table if not exists public.management_comparisons (
 id text primary key,statement_id text references public.management_statements,status text not null check(status in ('MET','MISSED','ON TRACK','NOT YET DUE','NOT COMPARABLE','INSUFFICIENT EVIDENCE')),actual numeric,actual_period text,result_document_id text references public.source_documents,explanation text,confidence numeric
);
create table if not exists public.alert_rules (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,configuration jsonb not null,updated_at timestamptz default now()
);
create table if not exists public.triggered_alerts (
 id text primary key,rule_id uuid references public.alert_rules,signal_id text not null,evaluated_at timestamptz not null,read_at timestamptz,payload jsonb not null
);
create table if not exists public.saved_signals (
 workspace_id uuid not null,signal_id text not null,saved_at timestamptz default now(),reviewed_at timestamptz,primary key(workspace_id,signal_id)
);
create table if not exists public.research_history (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,ticker text references public.companies,query text,created_at timestamptz default now()
);
create table if not exists public.ingestion_status (
 id bigint generated always as identity primary key,provider text not null,status text not null,detail text,as_of timestamptz,evaluated_at timestamptz default now()
);
-- Keep the normalised market/document tables in sync with the implemented cache path.
create or replace function public.mirror_finn_cache() returns trigger language plpgsql set search_path=public as $$
declare item jsonb; price jsonb; session jsonb; doc jsonb;
begin
 if new.key='ingestion' then
  for item in select value from jsonb_array_elements(new.value->'announcements') loop
   insert into companies(ticker,name) values(item->>'ticker',item->>'company') on conflict(ticker) do update set name=excluded.name;
   insert into announcements(id,ticker,published_at,title,description,category,priority,source_url,attachment_url,classification_method,confidence,ingested_at,raw_record)
   values(item->>'id',item->>'ticker',(item->>'publishedAt')::timestamptz,item->>'title',item->>'description',item->>'category',(item->>'priority')::int,item->>'sourceUrl',item->>'attachmentUrl',item->>'classificationMethod',(item->>'confidence')::numeric,(item->>'ingestedAt')::timestamptz,item)
   on conflict(id) do update set raw_record=excluded.raw_record;
  end loop;
  for price in select value from jsonb_array_elements(new.value->'prices') loop
   insert into companies(ticker,name) values(price->>'ticker',price->>'ticker') on conflict do nothing;
   for session in select value from jsonb_array_elements(price->'sessions') loop
    insert into daily_prices(ticker,session_at,close,volume,source_url,ingested_at) values(price->>'ticker',(session->>'date')::timestamptz,(session->>'close')::numeric,(session->>'volume')::bigint,price->>'sourceUrl',(price->>'retrievedAt')::timestamptz) on conflict(ticker,session_at) do update set close=excluded.close,volume=excluded.volume,ingested_at=excluded.ingested_at;
   end loop;
  end loop;
  for item in select value from jsonb_array_elements(new.value->'health') loop
   insert into ingestion_status(provider,status,detail,as_of) values(item->>'provider',item->>'status',item->>'detail',(item->>'asOf')::timestamptz);
  end loop;
 elsif new.key like 'doc:%' then
  doc=new.value;
  insert into companies(ticker,name) values(doc->>'ticker',doc->>'ticker') on conflict do nothing;
  insert into source_documents(id,ticker,title,kind,period,url,sha256,retrieved_at) values(doc->>'id',doc->>'ticker',doc->>'title',doc->>'kind',doc->>'period',doc->>'url',doc->>'hash',(doc->>'retrievedAt')::timestamptz) on conflict do nothing;
  for item in select value from jsonb_array_elements(doc->'pages') loop
   insert into document_chunks(document_id,page,content) values(doc->>'id',(item->>'page')::int,item->>'text') on conflict do nothing;
  end loop;
 end if;
 return new;
end $$;
drop trigger if exists mirror_finn_cache on public.app_cache;
create trigger mirror_finn_cache after insert or update on public.app_cache for each row execute function public.mirror_finn_cache();
-- No anonymous access. Server service-role key only; never expose it in NEXT_PUBLIC vars.
do $$ declare t text; begin
 foreach t in array array['app_cache','companies','portfolio_membership','daily_prices','announcements','source_documents','document_chunks','financial_facts','research_insights','management_statements','management_comparisons','alert_rules','triggered_alerts','saved_signals','research_history','ingestion_status'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
