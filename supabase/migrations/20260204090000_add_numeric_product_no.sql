-- Add a human-friendly incremental product number (starts at 1)
-- Keeps UUID `products.id` as the internal PK to avoid breaking foreign keys.

DO $$
BEGIN
  -- Add column (nullable first so we can backfill deterministically)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'product_no'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN product_no bigint;
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
      AND c.relname = 'products_product_no_seq'
  ) THEN
    CREATE SEQUENCE public.products_product_no_seq START WITH 1 INCREMENT BY 1;
  END IF;
END $$;

-- Backfill existing rows (stable ordering by created_at, then id)
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.products
  WHERE product_no IS NULL
)
UPDATE public.products p
SET product_no = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Ensure uniqueness & not-null going forward
ALTER TABLE public.products
  ALTER COLUMN product_no SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_no_key'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_no_key UNIQUE (product_no);
  END IF;
END $$;

-- Set default for new rows and bump sequence to max(product_no) + 1
ALTER TABLE public.products
  ALTER COLUMN product_no SET DEFAULT nextval('public.products_product_no_seq');

SELECT setval(
  'public.products_product_no_seq',
  COALESCE((SELECT MAX(product_no) FROM public.products), 0) + 1,
  false
);

