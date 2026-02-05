-- Add a simple numeric item_id for products (1, 2, 3, ...)
-- This is separate from the internal UUID primary key.

DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN item_id integer;
  END IF;
END $$;

-- Create sequence for future inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'products_item_id_seq'
  ) THEN
    CREATE SEQUENCE public.products_item_id_seq START WITH 1 INCREMENT BY 1;
  END IF;
END $$;

-- Backfill existing rows (stable ordering by created_at then id)
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.products
  WHERE item_id IS NULL
)
UPDATE public.products p
SET item_id = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Ensure uniqueness & not-null
ALTER TABLE public.products
  ALTER COLUMN item_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_item_id_key'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_item_id_key UNIQUE (item_id);
  END IF;
END $$;

-- Set default via sequence and align sequence to max(item_id) + 1
ALTER TABLE public.products
  ALTER COLUMN item_id SET DEFAULT nextval('public.products_item_id_seq');

SELECT setval(
  'public.products_item_id_seq',
  COALESCE((SELECT MAX(item_id) FROM public.products), 0) + 1,
  false
);

