-- Add the optional tailor portfolio link without rebuilding existing posts.
alter table posts add column if not exists tailor_id text;
