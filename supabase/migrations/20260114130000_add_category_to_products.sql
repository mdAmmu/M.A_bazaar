-- Add category column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category text;

-- Create index for better category filtering performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
