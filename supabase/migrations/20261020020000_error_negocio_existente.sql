-- "Tu cuenta ya tiene un negocio" usaba el código 42501 (permiso denegado) y la app lo mostraba
-- como "No tienes permiso". Ahora usa un código propio, CT001, que la app reconoce.

create or replace function public.register_business(business_name text, business_slug text)
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
    raise exception 'Tu cuenta ya tiene un negocio' using errcode = 'CT001';
  end if;

  insert into public.businesses (name, slug, status)
  values (trim(business_name), business_slug, 'pending')
  returning id into new_id;

  insert into public.profiles (user_id, role, business_id)
  values ((select auth.uid()), 'tenant_admin', new_id);

  return new_id;
end;
$$;
