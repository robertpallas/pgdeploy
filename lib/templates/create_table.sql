create table if not exists {{schema}}.{{table}}
(
  {{#columns}}
  {{name}} {{type}}{{#notNull}} not null{{/notNull}}{{#default}} default {{{default}}}{{/default}},
  {{/columns}}
  {{#creation}}
  creation_time timestamptz not null default current_timestamp,
  {{/creation}}
  {{#update}}
  update_time timestamptz not null default current_timestamp,
  {{/update}}
  id bigserial primary key
);