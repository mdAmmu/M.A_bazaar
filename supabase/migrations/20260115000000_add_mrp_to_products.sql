-- Add MRP column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS mrp decimal(10,2);
