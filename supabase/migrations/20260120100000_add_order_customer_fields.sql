-- Add customer detail columns for admin-created orders/bills
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS customer_phone text DEFAULT '',
ADD COLUMN IF NOT EXISTS customer_address text DEFAULT '';

