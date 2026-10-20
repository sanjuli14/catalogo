-- Paso 5: estadísticas del catálogo.
-- Cada visita al catálogo, cada producto abierto y cada clic a WhatsApp guarda un evento.
-- El público no lee ni escribe la tabla directamente: registra con track_event() y el dueño
-- consulta los totales con business_stats().

create type public.event_kind as enum ('catalog_view', 'item_view', 'whatsapp_click');

create table public.events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Producto abierto o pedido; null = el catálogo en general (o un pedido de varios).
  item_id uuid references public.items (id) on delete set null,
  kind public.event_kind not null,
  created_at timestamptz not null default now()
);

create index on public.events (business_id, created_at);
create index on public.events (item_id) where item_id is not null;

alter table public.events enable row level security;
-- Sin políticas ni permisos: solo se accede con las funciones de abajo.
revoke all on public.events from anon, authenticated;

-- Registra un evento de un negocio activo. Las visitas del dueño o del superadmin no cuentan.
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

revoke execute on function public.track_event(uuid, public.event_kind, uuid) from public;
grant execute on function public.track_event(uuid, public.event_kind, uuid) to anon, authenticated;

-- Totales desde una fecha, por día (en la zona horaria del navegador) y por producto.
-- Solo el dueño o el superadmin.
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
          count(*) filter (where kind in ('catalog_view', 'item_view')) as views,
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

revoke execute on function public.business_stats(uuid, timestamptz, text) from public, anon;
grant execute on function public.business_stats(uuid, timestamptz, text) to authenticated;
