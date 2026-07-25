-- Allow 'spoonacular' as a valid recipe source (in addition to 'ai' and 'user')
alter table recipes
  drop constraint if exists recipes_source_check;

alter table recipes
  add constraint recipes_source_check
  check (source in ('ai', 'user', 'spoonacular'));
