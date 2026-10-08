-- Adds a real category column so category filtering actually works
-- (previously the category nav/tiles just linked to the same catalog page
-- for everything). Nullable so existing products don't break; set it per
-- product from the admin panel.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IS NULL OR category IN ('Living', 'Bedroom', 'Dining', 'Office', 'Chairs', 'Tables', 'Storage'));

CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
