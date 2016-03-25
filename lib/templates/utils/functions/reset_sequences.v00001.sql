-- https://wiki.postgresql.org/wiki/Fixing_Sequences

create or replace function utils.reset_sequences() returns void as $$
declare
  commands text[];
  cmd text;
begin

  -- create array of setval commands for every sequence
  select array_agg('select setval(' ||
                   quote_literal(quote_ident(pgt.schemaname) || '.' || quote_ident(s.relname)) ||
                   ', coalesce(max(' ||quote_ident(c.attname)|| '), 1) ) from ' ||
                   quote_ident(pgt.schemaname)|| '.'||quote_ident(t.relname)|| ';') into commands
  from pg_class s,
    pg_depend d,
    pg_class t,
    pg_attribute c,
    pg_tables pgt
  where s.relkind = 'S'
        and s.oid = d.objid
        and d.refobjid = t.oid
        and d.refobjid = c.attrelid
        and d.refobjsubid = c.attnum
        and t.relname = pgt.tablename;

  -- execute all setval
  foreach cmd in array commands loop
    execute cmd;
  end loop;

end;
$$ language plpgsql;