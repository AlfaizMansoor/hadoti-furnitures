-- Razorpay online payments + server side payment verification.
-- Adds the columns the verification flow needs, an audit log of every gateway
-- event, and moves the default payment method off cash on delivery.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;

-- Cash on delivery is retired: UPI is the new default for any row that does
-- not state a method.
ALTER TABLE public.orders
  ALTER COLUMN payment_method SET DEFAULT 'upi';

-- Existing cash-on-delivery orders keep their history but are relabelled so no
-- screen shows a method the store no longer offers.
UPDATE public.orders
  SET payment_method = 'upi'
  WHERE payment_method = 'pay_on_delivery';

-- Only the payment methods the store actually accepts may be stored.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_allowed;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_allowed
  CHECK (payment_method IN ('razorpay', 'upi', 'bank_transfer'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_allowed;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_allowed
  CHECK (payment_status IN ('pending', 'awaiting_payment', 'verifying', 'paid', 'failed', 'refunded'));

-- One Razorpay order maps to exactly one of our orders.
CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_order_id_key
  ON public.orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Audit trail. Written only by the edge functions (service role); customers
-- never read or write it, admins may read it for support.
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  event TEXT NOT NULL,
  amount NUMERIC(12,2),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_order_id_idx ON public.payment_events (order_id);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_events TO service_role;
GRANT SELECT ON public.payment_events TO authenticated;

DROP POLICY IF EXISTS "Admins read payment events" ON public.payment_events;
CREATE POLICY "Admins read payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Customers no longer insert orders straight from the browser: the
-- create-payment-order edge function does it with the service role after
-- recalculating every price from the products table. Reads stay unchanged.
DROP POLICY IF EXISTS "Customers place own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers add items to own orders" ON public.order_items;
REVOKE INSERT ON public.orders FROM authenticated;
REVOKE INSERT ON public.order_items FROM authenticated;
