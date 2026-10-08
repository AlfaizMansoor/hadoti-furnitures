INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'alfaiz.vahindia@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.products
SET long_description = description || E'\n\nEvery piece is built in our own workshop from seasoned solid wood, finished by hand and inspected before dispatch. Delivery and assembly are included with your order, and the piece carries a one year warranty with replacement against manufacturing defects.'
WHERE long_description IS NULL;