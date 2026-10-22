-- Add Studio apartment to the existing property type constraint without
-- removing any property types already permitted by this database.
do $migration$
declare
  v_constraint_definition text;
  v_existing_expression text;
begin
  select pg_get_constraintdef(oid, true)
  into v_constraint_definition
  from pg_constraint
  where conrelid = 'public.properties'::regclass
    and conname = 'properties_property_type_check'
    and contype = 'c';

  if v_constraint_definition is null then
    raise exception 'Expected check constraint properties_property_type_check on public.properties';
  end if;

  if position('studio_apartment' in lower(v_constraint_definition)) = 0 then
    v_existing_expression := substring(
      v_constraint_definition from 8 for char_length(v_constraint_definition) - 8
    );

    alter table public.properties drop constraint properties_property_type_check;
    execute format(
      'alter table public.properties add constraint properties_property_type_check check ((%s) or property_type = %L)',
      v_existing_expression,
      'studio_apartment'
    );
  end if;
end;
$migration$;
