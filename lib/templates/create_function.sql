create function {{schema}}.{{function}}
(
  {{#params}}
  {{direction}} {{name}} {{type}}{{^last}},{{/last}}
  {{/params}}
) as $$
declare
begin
  -- TODO
end;
$$ language plpgsql;

