CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sku text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  discount_price numeric(12,2) CHECK (discount_price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold_out')),
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  is_new_arrival boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active products are publicly viewable"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_touch_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX products_name_idx ON public.products (name);
CREATE INDEX products_active_idx ON public.products (is_active);

INSERT INTO public.products (name, slug, sku, description, price, discount_price, stock, status, is_featured, is_new_arrival, is_bestseller, specifications, images, sort_order) VALUES
('Aravali Sheesham Sofa', 'aravali-sheesham-sofa', 'HF-SOF-001', 'A three seater sofa built on a solid sheesham frame with hand stitched beige upholstery and gently tapered legs.', 68900, 59900, 6, 'available', true, false, true, '[{"label":"Material","value":"Sheesham Wood"},{"label":"Colour","value":"Walnut / Beige"},{"label":"Dimensions","value":"78 x 34 x 32 in"},{"label":"Seating Capacity","value":"3"},{"label":"Warranty","value":"2 Years"}]'::jsonb, '["/site/img/sofa.jpg"]'::jsonb, 1),
('Bundi Dining Table', 'bundi-dining-table', 'HF-DIN-002', 'Six seater dining table with a thick solid wood top, chamfered edges and a warm natural oil finish.', 84500, NULL, 3, 'available', true, true, false, '[{"label":"Material","value":"Solid Mango Wood"},{"label":"Colour","value":"Natural Oak"},{"label":"Dimensions","value":"72 x 36 x 30 in"},{"label":"Seating Capacity","value":"6"}]'::jsonb, '["/site/img/dining.jpg"]'::jsonb, 2),
('Chittor Accent Chair', 'chittor-accent-chair', 'HF-CHR-003', 'A sculpted lounge chair with a curved back, cane detailing and cream cushioning.', 22400, 19900, 12, 'available', false, true, true, '[{"label":"Material","value":"Teak and Cane"},{"label":"Colour","value":"Cream"},{"label":"Weight","value":"9 kg"}]'::jsonb, '["/site/img/chair.jpg"]'::jsonb, 3),
('Devgarh Coffee Table', 'devgarh-coffee-table', 'HF-TBL-004', 'A low rectangular coffee table with a floating shelf and softly rounded walnut edges.', 18900, 16400, 9, 'available', true, false, false, '[{"label":"Material","value":"Walnut Veneer"},{"label":"Dimensions","value":"48 x 24 x 17 in"}]'::jsonb, '["/site/img/coffee-table.jpg"]'::jsonb, 4),
('Hadoti King Bed', 'hadoti-king-bed', 'HF-BED-005', 'King size bed with a panelled headboard, hydraulic storage and a deep walnut finish.', 96500, 88900, 2, 'available', true, true, true, '[{"label":"Material","value":"Sheesham Wood"},{"label":"Colour","value":"Deep Walnut"},{"label":"Size","value":"King (72 x 78 in)"},{"label":"Storage","value":"Hydraulic Lift"},{"label":"Warranty","value":"3 Years"}]'::jsonb, '["/site/img/bed.jpg"]'::jsonb, 5),
('Kota Study Desk', 'kota-study-desk', 'HF-DSK-006', 'A compact work desk with two drawers, cable routing and a matte tan finish.', 24900, NULL, 0, 'sold_out', false, false, false, '[{"label":"Material","value":"Engineered Wood and Oak"},{"label":"Dimensions","value":"47 x 22 x 30 in"}]'::jsonb, '["/site/img/desk.jpg"]'::jsonb, 6),
('Mewar Bookshelf', 'mewar-bookshelf', 'HF-SHF-007', 'A five tier open bookshelf with slim uprights and adjustable middle shelves.', 32900, 28900, 7, 'available', false, true, false, '[{"label":"Material","value":"Solid Mango Wood"},{"label":"Shelves","value":"5"},{"label":"Dimensions","value":"36 x 14 x 72 in"}]'::jsonb, '["/site/img/bookshelf.jpg"]'::jsonb, 7),
('Sawai Shoe Rack', 'sawai-shoe-rack', 'HF-RCK-008', 'A slim entryway shoe rack with three tilting compartments and a cushioned top.', 12900, 10900, 15, 'available', false, false, true, '[{"label":"Material","value":"Engineered Wood"},{"label":"Capacity","value":"9 Pairs"},{"label":"Colour","value":"Warm Beige"}]'::jsonb, '["/site/img/shoe-rack.jpg"]'::jsonb, 8);