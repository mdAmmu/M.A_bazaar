import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  avatar_url: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  product_no?: number;
  item_id?: number;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  image_url: string;
  stock: number;
  category?: string;
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  products?: Product;
};

export type Order = {
  id: string;
  user_id: string;
  total_amount: number;
  delivery_charge: number;
  discount: number;
  final_amount: number;
  status: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  created_at: string;
  products?: Product;
};

export type Bill = {
  id: string;
  order_id: string;
  user_id: string;
  bill_number: string;
  total_amount: number;
  delivery_charge: number;
  discount: number;
  final_amount: number;
  created_at: string;
};

export type BillItem = {
  id: string;
  bill_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  created_at: string;
};
