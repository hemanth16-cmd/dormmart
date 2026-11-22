-- Metadata supplied by the user, before the conversation-policy correction.
create policy "Read own conversations" on public.conversations for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = seller_id)));
create policy "Start own conversations" on public.conversations for INSERT to authenticated with check (((( SELECT auth.uid() AS uid) = buyer_id) AND (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = conversations.product_id) AND (p.seller_id = p.seller_id) AND (p.status = 'active'::text))))));
create policy "Read conversation messages" on public.messages for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid)))))));
create policy "Send conversation messages" on public.messages for INSERT to authenticated with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid))))))));
create policy "Add own product images" on public.product_images for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND (p.seller_id = ( SELECT auth.uid() AS uid))))));
create policy "Delete own product images" on public.product_images for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND (p.seller_id = ( SELECT auth.uid() AS uid))))));
create policy "Read product images" on public.product_images for SELECT to public using ((EXISTS ( SELECT 1
   FROM products p
  WHERE (p.id = product_images.product_id))));
create policy "Create own products" on public.products for INSERT to authenticated with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy "Delete own products" on public.products for DELETE to authenticated using ((seller_id = ( SELECT auth.uid() AS uid)));
create policy "Update own products" on public.products for UPDATE to authenticated using ((seller_id = ( SELECT auth.uid() AS uid))) with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy "View active products" on public.products for SELECT to public using (((status = 'active'::text) OR (seller_id = ( SELECT auth.uid() AS uid))));
create policy "Create own profile" on public.profiles for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = id));
create policy "Read profiles" on public.profiles for SELECT to authenticated using (true);
create policy "Update own profile" on public.profiles for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy "Delete own product photos" on storage.objects for DELETE to authenticated using (((bucket_id = 'product-images'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid)) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
create policy "Upload own product photos" on storage.objects for INSERT to authenticated with check (((bucket_id = 'product-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));