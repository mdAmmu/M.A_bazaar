-- ============================================
-- QUICK FIX: Run this SQL in Supabase Dashboard
-- ============================================
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- Copy and paste this entire file, then click "Run"

-- Create customers table for employee-managed customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
-- Employees can view their own customers
CREATE POLICY "Employees can view own customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Employees can insert their own customers
CREATE POLICY "Employees can insert own customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Employees can update their own customers
CREATE POLICY "Employees can update own customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Employees can delete their own customers
CREATE POLICY "Employees can delete own customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add employee_id to orders table first
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Add customer_id to orders table (after customers table is created)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Drop existing order policies (if they exist)
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

-- Recreate with employee support
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
