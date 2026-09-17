create table if not exists public.wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance_usd numeric(12,2) not null default 0 check (balance_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.wallets to service_role;
alter table public.wallets enable row level security;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  kind text not null check (kind in ('topup','purchase','refund','adjustment')),
  order_id uuid references public.shop_orders(id) on delete set null,
  note text,
  actor text not null default 'admin',
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_profile_idx on public.wallet_transactions(profile_id, created_at desc);
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;

create or replace function public.wallet_credit(_profile_id uuid, _amount numeric, _kind text, _note text default null, _order_id uuid default null, _actor text default 'admin')
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  _balance numeric(12,2);
begin
  if _amount is null or _amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;
  insert into public.wallets(profile_id, balance_usd)
  values (_profile_id, 0)
  on conflict (profile_id) do nothing;

  update public.wallets
     set balance_usd = balance_usd + round(_amount, 2),
         updated_at = now()
   where profile_id = _profile_id
  returning balance_usd into _balance;

  insert into public.wallet_transactions(profile_id, amount_usd, balance_after, kind, order_id, note, actor)
  values (_profile_id, round(_amount, 2), _balance, coalesce(_kind, 'topup'), _order_id, _note, coalesce(_actor, 'admin'));

  return _balance;
end;
$$;

create or replace function public.wallet_debit(_profile_id uuid, _amount numeric, _order_id uuid default null, _note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _balance numeric(12,2);
begin
  if _amount is null or _amount <= 0 then
    return false;
  end if;

  insert into public.wallets(profile_id, balance_usd)
  values (_profile_id, 0)
  on conflict (profile_id) do nothing;

  select balance_usd into _balance from public.wallets where profile_id = _profile_id for update;
  if _balance is null or _balance < round(_amount, 2) then
    return false;
  end if;

  update public.wallets
     set balance_usd = balance_usd - round(_amount, 2),
         updated_at = now()
   where profile_id = _profile_id
  returning balance_usd into _balance;

  insert into public.wallet_transactions(profile_id, amount_usd, balance_after, kind, order_id, note, actor)
  values (_profile_id, -round(_amount, 2), _balance, 'purchase', _order_id, _note, 'customer');

  return true;
end;
$$;

revoke all on function public.wallet_credit(uuid, numeric, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_debit(uuid, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_credit(uuid, numeric, text, text, uuid, text) to service_role;
grant execute on function public.wallet_debit(uuid, numeric, uuid, text) to service_role;

insert into public.payment_methods (provider, name, currency, channel, enabled, display_order, network, recipient, recipient_label, reference_label, instructions, settlement_asset)
select 'wallet', 'Wallet Balance (USD)', 'USDT', 'website', true, 0, null, null, null, null,
       'Pay instantly from your FOXGEN wallet balance. The amount is deducted the moment you place the order — no transaction reference needed.', 'USDT'
where not exists (select 1 from public.payment_methods where provider = 'wallet');