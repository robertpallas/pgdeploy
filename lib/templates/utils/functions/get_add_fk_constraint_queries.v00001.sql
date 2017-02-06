-- get all FK constraints alter queries
-- based on https://www.hagander.net/blog/automatically-dropping-and-creating-constraints-131/

create or replace function utils.get_add_fk_constraint_queries() returns text[] as $$
begin

  return array(select 'alter table "'||nspname||'"."'||relname||'" add constraint "'||conname||'" '||
    pg_get_constraintdef(pg_constraint.oid)||';'
  from pg_constraint
    inner join pg_class on conrelid=pg_class.oid
    inner join pg_namespace on pg_namespace.oid=pg_class.relnamespace
    where contype='f');

end;
$$ language plpgsql;

