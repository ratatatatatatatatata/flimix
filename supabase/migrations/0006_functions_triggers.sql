-- ============================================================
-- FLIMIX 0006 — helper functions & triggers
-- (created BEFORE 0007 because RLS policies depend on them)
-- ============================================================

-- ---------- role hierarchy helper ----------
-- user < content_manager < admin < super_admin
-- SECURITY DEFINER so it can read user_roles regardless of the
-- caller's RLS context (avoids recursive policy evaluation).

create or replace function public.role_rank(r public.user_role)
returns integer
language sql
immutable
as $$
  select case r
    when 'user'            then 1
    when 'content_manager' then 2
    when 'admin'           then 3
    when 'super_admin'     then 4
  end;
$$;

create or replace function public.has_role(uid uuid, min_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and public.role_rank(ur.role) >= public.role_rank(min_role)
  );
$$;

-- ---------- active-subscriber helper ----------

create or replace function public.is_subscriber(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and s.status in ('trial', 'active')
      and s.current_period_end > now()
  );
$$;

-- Lock helpers down: callable by API roles, not writable paths.
revoke all on function public.has_role(uuid, public.user_role) from public;
revoke all on function public.is_subscriber(uuid) from public;
grant execute on function public.role_rank(public.user_role) to anon, authenticated, service_role;
grant execute on function public.has_role(uuid, public.user_role) to anon, authenticated, service_role;
grant execute on function public.is_subscriber(uuid) to anon, authenticated, service_role;

-- ---------- updated_at maintenance ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_movies_updated_at
  before update on public.movies
  for each row execute function public.set_updated_at();

create trigger trg_series_updated_at
  before update on public.series
  for each row execute function public.set_updated_at();

create trigger trg_episodes_updated_at
  before update on public.episodes
  for each row execute function public.set_updated_at();

create trigger trg_content_rights_updated_at
  before update on public.content_rights
  for each row execute function public.set_updated_at();

-- ---------- new auth user bootstrap ----------
-- Creates a default viewing profile and the base 'user' role
-- for every new auth.users row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
