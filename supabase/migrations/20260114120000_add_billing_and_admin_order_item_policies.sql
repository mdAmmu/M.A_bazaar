/*
  # Billing / Invoices + Admin order editing support

  Adds:
  - bills: a snapshot/invoice created when admin prints a bill
  - bill_items: snapshot of order items at print time
  - RLS policies to allow admins to UPDATE/DELETE order_items (needed for admin order editing)
  - RLS policies to allow users/admins to read bills appropriately
*/

-- Bills table (invoice header)
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bill_number text NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  delivery_charge decimal(10,2) DEFAULT 0,
  discount decimal(10,2) DEFAULT 0,
  final_amount decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Bill items table (invoice lines)
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  price decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- Helpful unique index to prevent duplicate bills for the same order (optional but useful)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_order_id_unique ON bills(order_id);

-- ---------- Admin order editing support ----------
-- Allow admins to update/delete order_items (required for "Edit Order" to actually persist)
CREATE POLICY "Admins can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ---------- Bills RLS ----------
-- Users can view their own bills
CREATE POLICY "Users can view own bills"
  ON bills FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all bills
CREATE POLICY "Admins can view all bills"
  ON bills FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert bills
CREATE POLICY "Admins can insert bills"
  ON bills FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own bill items (via parent bill)
CREATE POLICY "Users can view own bill items"
  ON bill_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
      AND bills.user_id = auth.uid()
    )
  );

-- Admins can view all bill items
CREATE POLICY "Admins can view all bill items"
  ON bill_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert bill items
CREATE POLICY "Admins can insert bill items"
  ON bill_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);

