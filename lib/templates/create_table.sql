create table if not exists {{schema}}.{{table}}
(
  {{#columns}}
  {{name}} {{type}}{{#notNull}} not null{{/notNull}}{{#default}} default {{{default}}}{{/default}},
  {{/columns}}
  {{#creation}}
  created_at timestamptz not null default current_timestamp,
  {{/creation}}
  {{#update}}
  updated_at timestamptz not null default current_timestamp,
  {{/update}}
  id bigserial primary key
);