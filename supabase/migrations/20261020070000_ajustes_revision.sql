-- Paso 8: ajustes de la revisión de código.

-- ---------------------------------------------------------------------------
-- Estadísticas: tope de eventos por negocio
-- Cualquiera puede llamar a track_event: sin tope, un script podría inflar las cifras de
-- un negocio o llenar la tabla. Más de 120 eventos por minuto en un negocio no es tráfico
-- real de un catálogo pequeño; lo que pase de ahí se descarta.
-- ---------------------------------------------------------------------------
create or replace function public.track_event(
  target_business uuid,
  event_kind public.event_kind,
  target_item uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_business_active(target_business)
    or target_business = public.my_business_id()
    or public.is_superadmin() then
    return;
  end if;

  if (
    select count(*) from public.events
    where business_id = target_business and created_at > now() - interval '1 minute'
  ) >= 120 then
    return;
  end if;

  -- El producto tiene que ser de ese negocio; si no, se registra sin producto.
  if target_item is not null and not exists (
    select 1 from public.items where id = target_item and business_id = target_business
  ) then
    target_item := null;
  end if;

  insert into public.events (business_id, item_id, kind)
  values (target_business, target_item, event_kind);
end;
$$;

-- ---------------------------------------------------------------------------
-- Estadísticas: las visitas por día cuentan solo las visitas al catálogo, igual que el
-- total de arriba (antes sumaban también los productos vistos y no coincidían).
-- ---------------------------------------------------------------------------
create or replace function public.business_stats(
  target_business uuid,
  since timestamptz,
  time_zone text default 'UTC'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_business is distinct from public.my_business_id() and not public.is_superadmin() then
    raise exception 'No tienes permiso para ver estas estadísticas' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'catalog_views', (
      select count(*) from public.events
      where business_id = target_business and created_at >= since and kind = 'catalog_view'
    ),
    'item_views', (
      select count(*) from public.events
      where business_id = target_business and created_at >= since and kind = 'item_view'
    ),
    'whatsapp_clicks', (
      select count(*) from public.events
      where business_id = target_business and created_at >= since and kind = 'whatsapp_click'
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'clicks', clicks) order by day)
      from (
        select
          (created_at at time zone time_zone)::date as day,
          count(*) filter (where kind = 'catalog_view') as views,
          count(*) filter (where kind = 'whatsapp_click') as clicks
        from public.events
        where business_id = target_business and created_at >= since
        group by 1
      ) d
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object('item_id', item_id, 'views', views, 'clicks', clicks)
        order by views desc, clicks desc
      )
      from (
        select
          item_id,
          count(*) filter (where kind = 'item_view') as views,
          count(*) filter (where kind = 'whatsapp_click') as clicks
        from public.events
        where business_id = target_business and created_at >= since and item_id is not null
        group by item_id
        order by views desc, clicks desc
        limit 20
      ) i
    ), '[]'::jsonb)
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Variantes: cada opción tiene que tener la forma que espera la app.
-- ---------------------------------------------------------------------------
create or replace function public.valid_variants(variants jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(variants) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(variants) as v
      where jsonb_typeof(v) <> 'object'
        or jsonb_typeof(v -> 'id') is distinct from 'string'
        or jsonb_typeof(v -> 'name') is distinct from 'string'
        or length(trim(v ->> 'name')) = 0
        or jsonb_typeof(v -> 'is_available') is distinct from 'boolean'
        or coalesce(jsonb_typeof(v -> 'price'), 'missing') not in ('null', 'number')
        or (jsonb_typeof(v -> 'price') = 'number' and (v ->> 'price')::numeric < 0)
    );
$$;

alter table public.items
  drop constraint items_variants_check,
  add constraint items_variants_check check (public.valid_variants(variants));
