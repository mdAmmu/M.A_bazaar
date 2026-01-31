-- ============================================
-- FIX: Make user_id nullable in orders table
-- ============================================
-- Run this SQL in Supabase Dashboard > SQL Editor
-- This allows employee-created orders (which don't have user_id)

-- Make user_id nullable in orders table
-- Employee-created orders will have employee_id but no user_id
ALTER TABLE orders
ALTER COLUMN user_id DROP NOT NULL;

-- Verify the change
-- You can check with: SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id';
