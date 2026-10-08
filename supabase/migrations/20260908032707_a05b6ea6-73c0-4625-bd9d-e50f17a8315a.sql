DROP POLICY IF EXISTS "Admins can view every product" ON public.products;
CREATE POLICY "Admins can view every product"
ON public.products FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

DROP POLICY IF EXISTS "Admins can add products" ON public.products;
CREATE POLICY "Admins can add products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

DROP POLICY IF EXISTS "Admins can edit products" ON public.products;
CREATE POLICY "Admins can edit products"
ON public.products FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

DROP POLICY IF EXISTS "Admins can remove products" ON public.products;
CREATE POLICY "Admins can remove products"
ON public.products FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));