-- Registro de dueños con aprobación:
-- el dueño crea su cuenta y su negocio, que queda "pending" (el público no lo ve)
-- hasta que el superadmin lo cambia a "active".

alter type public.business_status add value if not exists 'pending';

-- /registro es una página de la app: ningún negocio puede usarla como dirección.
alter table public.businesses
  drop constraint businesses_slug_check1,
  add constraint businesses_slug_reserved
    check (slug not in ('login', 'admin', 'superadmin', 'api', 'assets', 'registro'));

-- ¿Se puede usar esta dirección web? Lo usa la pantalla de registro antes de crear la cuenta.
create function public.slug_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(candidate) between 3 and 50
    and candidate not in ('login', 'admin', 'superadmin', 'api', 'assets', 'registro')
    and not exists (select 1 from public.businesses where slug = candidate);
$$;

-- Crea el negocio (pendiente) del usuario que acaba de registrarse y lo hace su dueño.
-- plpgsql: el valor 'pending' recién agregado no se valida hasta ejecutarla.
create function public.register_business(business_name text, business_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where user_id = (select auth.uid())) then
    raise exception 'Tu cuenta ya tiene un negocio' using errcode = '42501';
  end if;

  insert into public.businesses (name, slug, status)
  values (trim(business_name), business_slug, 'pending')
  returning id into new_id;

  insert into public.profiles (user_id, role, business_id)
  values ((select auth.uid()), 'tenant_admin', new_id);

  return new_id;
end;
$$;

revoke execute on function public.register_business(text, text) from public, anon;
grant execute on function public.register_business(text, text) to authenticated;
grant execute on function public.slug_available(text) to anon, authenticated;
