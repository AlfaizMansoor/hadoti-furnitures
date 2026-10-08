-- Checkout now collects a separate landmark field, and manual payment
-- verification (UPI / bank transfer) records which admin verified it.

-- The "Admins update orders" policy (added earlier) never had a matching
-- table-level grant, so even an admin's UPDATE would be rejected before RLS
-- was ever consulted. The policy still does the real access check; this only
-- grants the base privilege.
GRANT UPDATE ON public.orders TO authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS landmark text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_verified_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.orders.admin_verified_by IS
  'Admin who confirmed a manual (UPI/bank transfer) payment. Null for Razorpay orders, which are verified by the server automatically.';
