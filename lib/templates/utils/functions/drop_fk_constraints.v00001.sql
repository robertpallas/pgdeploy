-- drop all FK constraints
-- based on https://www.hagander.net/blog/automatically-dropping-and-creating-constraints-131/

create or replace function utils.drop_fk_constraints() returns void as $$
  declare arr text[];
  declare drop_fk_query text;
begin

  arr = array(select 'alter table "'||nspname||'"."'||relname||'" drop constraint "'||conname||'";'
    from pg_constraint
      inner join pg_class on conrelid=pg_class.oid
      inner join pg_namespace on pg_namespace.oid=pg_class.relnamespace
    where contype='f');

  foreach drop_fk_query in array arr
  loop
    execute drop_fk_query;
  end loop;

end;
$$ language plpgsql;