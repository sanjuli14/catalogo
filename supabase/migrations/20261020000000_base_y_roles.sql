-- Paso 1: base y roles.
-- Tablas multi-negocio (cada fila lleva business_id) protegidas con RLS:
--   * superadmin: lee y edita todo.
--   * tenant_admin: solo lee y edita su propio negocio.
--   * público (anon): solo lee negocios activos y sus productos visibles.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('superadmin', 'tenant_admin');
create type public.business_status as enum ('active', 'suspended');
create type public.item_kind as enum ('product', 'service');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  -- Dirección pública del catálogo: /mi-tienda
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 50)
    check (slug not in ('login', 'admin', 'superadmin', 'api', 'assets')),
  name text not null check (length(trim(name)) > 0),
  description text,
  logo_path text,
  primary_color text not null default '#2563eb' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#f59e0b' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  currency text not null default 'USD',
  phone text,
  whatsapp text,
  email text,
  address text,
  schedule text,
  -- { "instagram": "...", "facebook": "...", "tiktok": "..." }
  socials jsonb not null default '{}'::jsonb,
  status public.business_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'tenant_admin',
  business_id uuid references public.businesses (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Un dueño de negocio siempre apunta a su negocio (o a ninguno si se borró).
  check (role = 'tenant_admin' or business_id is null)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- Permite que items exija que su categoría sea del mismo negocio.
  unique (id, business_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid,
  kind public.item_kind not null default 'product',
  name text not null check (length(trim(name)) > 0),
  description text,
  -- null = "precio a consultar"
  price numeric(12, 2) check (price >= 0),
  -- Rutas dentro del bucket "catalog": {business_id}/items/...
  photos text[] not null default '{}',
  is_available boolean not null default true,
  is_visible boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, business_id)
    references public.categories (id, business_id) on delete set null (category_id)
);

create index on public.profiles (business_id);
create index on public.categories (business_id, position);
create index on public.items (business_id, position);
create index on public.items (category_id);

-- ---------------------------------------------------------------------------
-- Funciones de apoyo para las políticas
-- security definer: leen profiles sin pasar por su RLS (evita recursión).
-- ---------------------------------------------------------------------------
create function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'superadmin'
  );
$$;

create function public.my_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select business_id from public.profiles where user_id = (select auth.uid());
$$;

create function public.is_business_active(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses where id = target and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- El dueño puede editar su negocio, pero no activarlo ni suspenderlo.
-- Solo aplica a usuarios de la API; el SQL editor y la service role no se bloquean.
create function public.guard_business_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and (select auth.role()) in ('anon', 'authenticated')
    and not public.is_superadmin() then
    raise exception 'Solo el superadmin puede cambiar el estado del negocio';
  end if;
  return new;
end;
$$;

create trigger businesses_guard_status
  before update on public.businesses
  for each row execute function public.guard_business_status();

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;

grant select on public.businesses, public.categories, public.items to anon, authenticated;
grant insert, update, delete on public.businesses, public.categories, public.items to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- businesses
create policy "businesses: lectura"
  on public.businesses for select to anon, authenticated
  using (
    status = 'active'
    or id = (select public.my_business_id())
    or (select public.is_superadmin())
  );

create policy "businesses: alta solo superadmin"
  on public.businesses for insert to authenticated
  with check ((select public.is_superadmin()));

create policy "businesses: edición dueño o superadmin"
  on public.businesses for update to authenticated
  using (id = (select public.my_business_id()) or (select public.is_superadmin()))
  with check (id = (select public.my_business_id()) or (select public.is_superadmin()));

create policy "businesses: baja solo superadmin"
  on public.businesses for delete to authenticated
  using ((select public.is_superadmin()));

-- profiles: cada uno ve el suyo; solo el superadmin los crea y asigna.
create policy "profiles: lectura propia o superadmin"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));

create policy "profiles: gestión solo superadmin"
  on public.profiles for all to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

-- categories
create policy "categories: lectura"
  on public.categories for select to anon, authenticated
  using (
    public.is_business_active(business_id)
    or business_id = (select public.my_business_id())
    or (select public.is_superadmin())
  );

create policy "categories: gestión dueño o superadmin"
  on public.categories for all to authenticated
  using (business_id = (select public.my_business_id()) or (select public.is_superadmin()))
  with check (business_id = (select public.my_business_id()) or (select public.is_superadmin()));

-- items: el público solo ve los visibles de negocios activos.
create policy "items: lectura"
  on public.items for select to anon, authenticated
  using (
    (is_visible and public.is_business_active(business_id))
    or business_id = (select public.my_business_id())
    or (select public.is_superadmin())
  );

create policy "items: gestión dueño o superadmin"
  on public.items for all to authenticated
  using (business_id = (select public.my_business_id()) or (select public.is_superadmin()))
  with check (business_id = (select public.my_business_id()) or (select public.is_superadmin()));

-- ---------------------------------------------------------------------------
-- Storage: bucket público "catalog", una carpeta por negocio ({business_id}/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Las fotos se ven por su URL pública; esta política es para listar y para upsert.
create policy "catalog: ver la carpeta propia"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'catalog'
    and (
      (storage.foldername(name))[1] = (select public.my_business_id())::text
      or (select public.is_superadmin())
    )
  );

create policy "catalog: subir en la carpeta propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalog'
    and (
      (storage.foldername(name))[1] = (select public.my_business_id())::text
      or (select public.is_superadmin())
    )
  );

create policy "catalog: editar en la carpeta propia"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'catalog'
    and (
      (storage.foldername(name))[1] = (select public.my_business_id())::text
      or (select public.is_superadmin())
    )
  );

create policy "catalog: borrar en la carpeta propia"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'catalog'
    and (
      (storage.foldername(name))[1] = (select public.my_business_id())::text
      or (select public.is_superadmin())
    )
  );
