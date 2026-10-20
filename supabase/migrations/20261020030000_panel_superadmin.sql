-- Paso 4: panel del superadmin.

-- Lista de negocios con los correos de sus dueños (auth.users no se puede leer desde la app).
create or replace function public.admin_list_businesses()
returns table (
  id uuid,
  slug text,
  name text,
  status public.business_status,
  logo_path text,
  created_at timestamptz,
  owners jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Solo el superadmin puede ver esta lista' using errcode = '42501';
  end if;

  return query
    select
      b.id,
      b.slug,
      b.name,
      b.status,
      b.logo_path,
      b.created_at,
      coalesce(
        (
          select jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email) order by u.email)
          from public.profiles p
          join auth.users u on u.id = p.user_id
          where p.business_id = b.id
        ),
        '[]'::jsonb
      )
    from public.businesses b
    order by b.created_at desc;
end;
$$;

revoke execute on function public.admin_list_businesses() from public, anon;
grant execute on function public.admin_list_businesses() to authenticated;

-- Para la Edge Function de invitaciones: ¿ese correo ya tiene cuenta?
-- Solo la service role puede llamarla (nadie desde la app).
create or replace function public.find_user_id_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(target_email)) limit 1;
$$;

revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- Páginas nuevas de la app (/recuperar y /definir-contrasena): ningún negocio puede usarlas.
alter table public.businesses
  drop constraint if exists businesses_slug_reserved,
  add constraint businesses_slug_reserved check (
    slug not in (
      'login', 'admin', 'superadmin', 'api', 'assets', 'registro', 'recuperar', 'definir-contrasena'
    )
  );

create or replace function public.slug_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(candidate) between 3 and 50
    and candidate not in (
      'login', 'admin', 'superadmin', 'api', 'assets', 'registro', 'recuperar', 'definir-contrasena'
    )
    and not exists (select 1 from public.businesses where slug = candidate);
$$;
