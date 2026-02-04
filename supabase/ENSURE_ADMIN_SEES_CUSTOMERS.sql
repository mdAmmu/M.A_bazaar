-- Run this in Supabase Dashboard > SQL Editor if Admin still doesn't see customers.
-- 1) Ensures admins can SELECT all rows from customers.
-- 2) Ensures your profile has role 'admin' (replace YOUR_AUTH_USER_ID with your auth.users id).

-- Drop and recreate policy so admin can view all customers (in case of conflict)
DROP POLICY IF EXISTS "Employees can view own customers" ON customers;

CREATE POLICY "Employees can view own customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Set your user as admin (replace the id with your auth user id from Authentication > Users)
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_AUTH_USER_ID';
