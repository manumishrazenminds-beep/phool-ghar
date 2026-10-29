-- Phool Ghar: extensions and enums. Safe to re-run.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.app_role as enum ('customer', 'admin', 'staff', 'delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum
    ('placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sub_status as enum
    ('pending_payment', 'active', 'paused', 'on_hold', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded');
exception when duplicate_object then null; end $$;
