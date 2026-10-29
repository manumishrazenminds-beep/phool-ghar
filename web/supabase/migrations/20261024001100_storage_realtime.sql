-- Phool Ghar: realtime publication and storage buckets/policies. Safe to re-run.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
  end if;
end $$;

-- Buckets: product-images is public read (5 MB, images only); invoices is private (service role writes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit)
values ('invoices', 'invoices', false, 5242880)
on conflict (id) do update set public = false;

drop policy if exists pg_product_images_read on storage.objects;
create policy pg_product_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
drop policy if exists pg_product_images_insert on storage.objects;
create policy pg_product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_perm('products'));
drop policy if exists pg_product_images_update on storage.objects;
create policy pg_product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_perm('products'))
  with check (bucket_id = 'product-images' and public.has_perm('products'));
drop policy if exists pg_product_images_delete on storage.objects;
create policy pg_product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_perm('products'));

-- invoices/<user_id>/<file>: owner or order staff can read; no client writes at all.
drop policy if exists pg_invoices_read on storage.objects;
create policy pg_invoices_read on storage.objects for select to authenticated
  using (bucket_id = 'invoices'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('orders')));
