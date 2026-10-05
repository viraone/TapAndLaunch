-- How each AI build went, for tuning speed: the model that answered and a timeline of the build (when the plan was
-- done, and when each section started, showed its first text and finished). Written by the server only.
alter table public.ai_generations add column if not exists details jsonb;
