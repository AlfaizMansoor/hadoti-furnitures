-- Long description for the product details section
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS long_description TEXT;

-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admins manage the catalogue
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

DROP POLICY IF EXISTS "Admins can view every product" ON public.products;
CREATE POLICY "Admins can view every product"
ON public.products FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can add products" ON public.products;
CREATE POLICY "Admins can add products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can edit products" ON public.products;
CREATE POLICY "Admins can edit products"
ON public.products FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can remove products" ON public.products;
CREATE POLICY "Admins can remove products"
ON public.products FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));