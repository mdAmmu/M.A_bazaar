/*
  # E-Commerce Application Schema

  ## 1. New Tables
    
  ### `profiles`
    - `id` (uuid, primary key, references auth.users)
    - `name` (text)
    - `email` (text)
    - `phone` (text)
    - `address` (text)
    - `avatar_url` (text)
    - `role` (text, default 'user') - either 'user' or 'admin'
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### `products`
    - `id` (uuid, primary key)
    - `name` (text)
    - `description` (text)
    - `price` (decimal)
    - `image_url` (text)
    - `stock` (integer)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### `cart_items`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `product_id` (uuid, references products)
    - `quantity` (integer)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### `orders`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `total_amount` (decimal)
    - `delivery_charge` (decimal)
    - `discount` (decimal)
    - `final_amount` (decimal)
    - `status` (text, default 'pending')
    - `created_at` (timestamptz)

  ### `order_items`
    - `id` (uuid, primary key)
    - `order_id` (uuid, references orders)
    - `product_id` (uuid, references products)
    - `quantity` (integer)
    - `price` (decimal)
    - `subtotal` (decimal)
    - `created_at` (timestamptz)

  ## 2. Security
    - Enable RLS on all tables
    - Users can read their own profile data
    - Users can update their own profile data
    - Anyone can view products
    - Admins can manage products
    - Users can manage their own cart items
    - Users can view their own orders
    - Admins can view all orders

  ## 3. Important Notes
    - Profile is automatically created when user signs up
    - Cart items are unique per user/product combination
    - Orders track complete purchase history
    - Default role is 'user', admin role must be set manually
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text DEFAULT '',
  address text DEFAULT '',
  avatar_url text DEFAULT '',
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price decimal(10,2) NOT NULL,
  image_url text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount decimal(10,2) NOT NULL,
  delivery_charge decimal(10,2) DEFAULT 0,
  discount decimal(10,2) DEFAULT 0,
  final_amount decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  price decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for products
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
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

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for cart_items
CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
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

-- RLS Policies for order_items
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Insert sample products
INSERT INTO products (name, description, price, image_url, stock) VALUES
  ('Wireless Headphones', 'High-quality Bluetooth headphones with noise cancellation', 79.99, 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=800', 50),
  ('Smart Watch', 'Fitness tracking smartwatch with heart rate monitor', 199.99, 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=800', 30),
  ('Laptop Backpack', 'Durable backpack with padded laptop compartment', 49.99, 'https://images.pexels.com/photos/2905238/pexels-photo-2905238.jpeg?auto=compress&cs=tinysrgb&w=800', 100),
  ('USB-C Cable', 'Fast charging USB-C to USB-C cable 6ft', 12.99, 'https://images.pexels.com/photos/163125/board-printed-circuit-board-computer-electronics-163125.jpeg?auto=compress&cs=tinysrgb&w=800', 200),
  ('Wireless Mouse', 'Ergonomic wireless mouse with adjustable DPI', 29.99, 'https://images.pexels.com/photos/2115257/pexels-photo-2115257.jpeg?auto=compress&cs=tinysrgb&w=800', 75),
  ('Portable Charger', '20000mAh power bank with fast charging', 39.99, 'https://images.pexels.com/photos/4968382/pexels-photo-4968382.jpeg?auto=compress&cs=tinysrgb&w=800', 60),
  ('Bluetooth Speaker', 'Waterproof portable speaker with 12-hour battery', 59.99, 'https://images.pexels.com/photos/1279406/pexels-photo-1279406.jpeg?auto=compress&cs=tinysrgb&w=800', 45),
  ('Phone Case', 'Shockproof protective case for smartphones', 19.99, 'https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=800', 150)
ON CONFLICT DO NOTHING;