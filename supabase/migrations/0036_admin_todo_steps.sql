-- A to-do item on the daily board can carry steps: smaller items under it, each with its own tick. When the last step is
-- ticked the item is done too; ticking the item ticks all of its steps.

alter table public.admin_todos
  add column parent_id uuid references public.admin_todos(id) on delete cascade;

create index admin_todos_parent_id_idx on public.admin_todos (parent_id);
