-- Group feedback sections submitted together into a single review.
alter table public.reviews add column if not exists submission_id uuid;

-- Refresh PostgREST schema cache so the new column is queryable immediately.
select pg_notify('pgrst', 'reload schema');
