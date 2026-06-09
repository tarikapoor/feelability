-- Capture how the reviewer knows the person being reviewed.
alter table public.reviews add column if not exists relationship text;

-- Refresh PostgREST schema cache so the new column is queryable immediately.
select pg_notify('pgrst', 'reload schema');
