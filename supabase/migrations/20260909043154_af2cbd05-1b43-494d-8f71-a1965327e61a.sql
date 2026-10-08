ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Admins read every order"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read every order item"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read every profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));