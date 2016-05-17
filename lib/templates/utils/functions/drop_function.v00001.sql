-- delete this function by name and all its versions with any combination of parameters
-- influenced by http://stackoverflow.com/a/7623246

create or replace function utils.drop_function(i_schema text, i_name text) returns void as $$
begin

  if exists(select 1 from
      pg_proc p left join pg_namespace n on p.pronamespace = n.oid
    where
      n.nspname = i_schema and
      p.proname = i_name)
  then

    execute (
      select string_agg(format('drop function %s(%s);', p.oid::regproc, pg_catalog.pg_get_function_identity_arguments(p.oid)), e'\n')
      from
        pg_proc p left join pg_namespace n on p.pronamespace = n.oid
      where
        n.nspname = i_schema and
        p.proname = i_name
    );

  end if;
end;
$$ language plpgsql;

