-- REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Phase 5Y.7 local review artifact for Telegram Vault RPC SQL.
-- This file contains executable SQL for review only. Do not run it in Supabase
-- until the target project, Vault API, grants, verifier output, and rollout
-- timing are explicitly approved.

begin;

create extension if not exists supabase_vault cascade;

create table if not exists public.telegram_bot_token_secrets (
  token_secret_ref text primary key,
  vault_secret_id uuid not null,
  agent_id uuid not null,
  owner_user_id uuid not null,
  telegram_bot_id text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table public.telegram_bot_token_secrets enable row level security;

revoke all on public.telegram_bot_token_secrets from public;
revoke all on public.telegram_bot_token_secrets from anon;
revoke all on public.telegram_bot_token_secrets from authenticated;
grant select, insert, update on public.telegram_bot_token_secrets to service_role;

create unique index if not exists telegram_bot_token_secrets_active_bot_id_key
  on public.telegram_bot_token_secrets (telegram_bot_id)
  where revoked_at is null;

create or replace function public.store_telegram_bot_token(
  p_agent_id uuid,
  p_owner_user_id uuid,
  p_telegram_bot_id text,
  p_bot_token text
) returns text
language plpgsql
security definer
set search_path = pg_catalog, vault, pg_temp
as $$
declare
  v_token_secret_ref text;
  v_vault_secret_id uuid;
begin
  if p_agent_id is null then
    raise exception 'invalid_agent_id' using errcode = '22023';
  end if;

  if p_owner_user_id is null then
    raise exception 'invalid_owner_user_id' using errcode = '22023';
  end if;

  if p_telegram_bot_id is null or btrim(p_telegram_bot_id) = '' then
    raise exception 'invalid_telegram_bot_id' using errcode = '22023';
  end if;

  if p_bot_token is null or btrim(p_bot_token) = '' then
    raise exception 'invalid_bot_token' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.telegram_bot_token_secrets secrets
    where secrets.telegram_bot_id = btrim(p_telegram_bot_id)
      and secrets.revoked_at is null
  ) then
    raise exception 'telegram_bot_already_connected' using errcode = '23505';
  end if;

  v_vault_secret_id := vault.create_secret(
    btrim(p_bot_token),
    null::text,
    'Kyra Telegram BotFather token'
  );
  v_token_secret_ref := 'vault:telegram:' || v_vault_secret_id::text;

  insert into public.telegram_bot_token_secrets (
    token_secret_ref,
    vault_secret_id,
    agent_id,
    owner_user_id,
    telegram_bot_id
  ) values (
    v_token_secret_ref,
    v_vault_secret_id,
    p_agent_id,
    p_owner_user_id,
    btrim(p_telegram_bot_id)
  );

  return v_token_secret_ref;
exception
  when invalid_parameter_value then
    raise;
  when unique_violation then
    raise exception 'telegram_bot_already_connected' using errcode = '23505';
  when others then
    raise exception 'telegram_token_store_failed' using errcode = 'XX000';
end;
$$;

create or replace function public.resolve_telegram_bot_token(
  p_token_secret_ref text
) returns text
language plpgsql
security definer
set search_path = pg_catalog, vault, pg_temp
as $$
declare
  v_vault_secret_id uuid;
  v_bot_token text;
begin
  if p_token_secret_ref is null or btrim(p_token_secret_ref) = '' then
    raise exception 'invalid_token_secret_ref' using errcode = '22023';
  end if;

  select secrets.vault_secret_id
  into v_vault_secret_id
  from public.telegram_bot_token_secrets secrets
  where secrets.token_secret_ref = btrim(p_token_secret_ref)
    and secrets.revoked_at is null;

  if v_vault_secret_id is null then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  select decrypted.decrypted_secret
  into v_bot_token
  from vault.decrypted_secrets decrypted
  where decrypted.id = v_vault_secret_id;

  if v_bot_token is null or btrim(v_bot_token) = '' then
    raise exception 'secret_not_found' using errcode = 'P0002';
  end if;

  return v_bot_token;
exception
  when invalid_parameter_value then
    raise;
  when no_data_found then
    raise exception 'secret_not_found' using errcode = 'P0002';
  when others then
    raise exception 'telegram_token_resolve_failed' using errcode = 'XX000';
end;
$$;

create or replace function public.revoke_telegram_bot_token(
  p_token_secret_ref text
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, vault, pg_temp
as $$
declare
  v_vault_secret_id uuid;
begin
  if p_token_secret_ref is null or btrim(p_token_secret_ref) = '' then
    raise exception 'invalid_token_secret_ref' using errcode = '22023';
  end if;

  select secrets.vault_secret_id
  into v_vault_secret_id
  from public.telegram_bot_token_secrets secrets
  where secrets.token_secret_ref = btrim(p_token_secret_ref)
    and secrets.revoked_at is null
  for update;

  if v_vault_secret_id is null then
    return false;
  end if;

  update public.telegram_bot_token_secrets secrets
  set revoked_at = now()
  where secrets.token_secret_ref = btrim(p_token_secret_ref)
    and secrets.revoked_at is null;

  return true;
exception
  when invalid_parameter_value then
    raise;
  when others then
    raise exception 'telegram_token_revoke_failed' using errcode = 'XX000';
end;
$$;

revoke execute on function public.store_telegram_bot_token(uuid, uuid, text, text) from public;
revoke execute on function public.resolve_telegram_bot_token(text) from public;
revoke execute on function public.revoke_telegram_bot_token(text) from public;
revoke execute on function public.store_telegram_bot_token(uuid, uuid, text, text) from anon;
revoke execute on function public.resolve_telegram_bot_token(text) from anon;
revoke execute on function public.revoke_telegram_bot_token(text) from anon;
revoke execute on function public.store_telegram_bot_token(uuid, uuid, text, text) from authenticated;
revoke execute on function public.resolve_telegram_bot_token(text) from authenticated;
revoke execute on function public.revoke_telegram_bot_token(text) from authenticated;
grant execute on function public.store_telegram_bot_token(uuid, uuid, text, text) to service_role;
grant execute on function public.resolve_telegram_bot_token(text) to service_role;
grant execute on function public.revoke_telegram_bot_token(text) to service_role;

commit;
