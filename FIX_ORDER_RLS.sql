-- ============================================
-- FIX: Allow Employees to Insert Orders
-- ============================================
-- Run this SQL in Supabase Dashboard > SQL Editor

-- First, ensure the columns exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

-- Create a new INSERT policy that allows:
-- 1. Users inserting their own orders (user_id = auth.uid())
-- 2. Employees inserting orders with their employee_id
-- 3. Admins inserting any orders
CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user_id matches authenticated user
    user_id = auth.uid() OR
    -- Allow if employee_id matches authenticated user (for employee-created orders)
    employee_id = auth.uid() OR
    -- Allow if user is an admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    ) OR
    -- Allow if user has employee role
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
    )
  );

-- Also ensure SELECT policy allows employees to view their orders
DROP POLICY IF EXISTS "Users can view own orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'employee')
    )
  );

-- Employees/Admins can update their own orders
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'employee')
    )
  );

-- Employees/Admins can delete their own orders
DROP POLICY IF EXISTS "Users can delete own orders" ON orders;
CREATE POLICY "Users can delete own orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'employee')
    )
  );

-- Ensure order_items can be inserted/updated/deleted by employees
-- Check if order_items INSERT policy exists and update it
DROP POLICY IF EXISTS "Users can insert order items" ON order_items;
CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.employee_id = auth.uid() OR orders.user_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'employee')
    )
  );

DROP POLICY IF EXISTS "Users can update order items" ON order_items;
CREATE POLICY "Users can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.employee_id = auth.uid() OR orders.user_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'employee')
    )
  );

DROP POLICY IF EXISTS "Users can delete order items" ON order_items;
CREATE POLICY "Users can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.employee_id = auth.uid() OR orders.user_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'employee')
    )
  );
