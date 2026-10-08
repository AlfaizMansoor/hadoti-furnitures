-- Run this AFTER creating both accounts in the Supabase Dashboard
-- (Authentication -> Users -> Add User), so their passwords are hashed
-- properly by Supabase Auth rather than ever touching a plaintext value
-- in a file. This script only grants the admin role by email — it never
-- sees or stores a password.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email IN ('devuqaab@gmail.com', 'alfaizmansoordev@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Confirm both got the role:
SELECT u.email, r.role
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
WHERE u.email IN ('devuqaab@gmail.com', 'alfaizmansoordev@gmail.com');