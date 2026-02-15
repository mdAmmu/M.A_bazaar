import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CartItem, Product } from '../../lib/supabase';

type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills';

interface CheckoutProps {
  onNavigate: (page: Page) => void;
}

interface CartItemWithProduct extends CartItem {
  products: Product;
}

export default function Checkout({ onNavigate }: CheckoutProps) {
  const { profile } = useAuth();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const DELIVERY_CHARGE = 10;
  const DISCOUNT = 0;

  useEffect(() => {
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (*)
        `)
        .eq('user_id', profile?.id);

      if (error) throw error;
      setCartItems((data as CartItemWithProduct[]) || []);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalAmount = () => {
    return cartItems.reduce(
      (sum, item) => sum + item.products.price * item.quantity,
      0
    );
  };

  const getFinalAmount = () => {
    return getTotalAmount() + DELIVERY_CHARGE - DISCOUNT;
  };

  const placeOrder = async () => {
    if (!profile?.address || !profile?.phone) {
      alert('Please update your profile with address and phone number before placing an order');
      onNavigate('profile');
      return;
    }

    setPlacing(true);
    try {
      const totalAmount = getTotalAmount();
      const finalAmount = getFinalAmount();

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: profile.id,
            total_amount: totalAmount,
            delivery_charge: DELIVERY_CHARGE,
            discount: DISCOUNT,
            final_amount: finalAmount,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products.price,
        subtotal: item.products.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', profile.id);

      if (clearCartError) throw clearCartError;

      setOrderPlaced(true);
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-20 w-20 text-green-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Placed Successfully!
          </h1>
          <p className="text-gray-600 mb-8">
            Thank you for your order. We'll send you a confirmation email shortly.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    onNavigate('cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate('cart')}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Cart
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Delivery Address
          </h2>
          <div className="space-y-2 text-gray-700">
            <p className="font-semibold">{profile?.name}</p>
            <p>{profile?.phone || 'Phone not provided'}</p>
            <p>{profile?.address || 'Address not provided'}</p>
          </div>
          {(!profile?.address || !profile?.phone) && (
            <button
              onClick={() => onNavigate('profile')}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Update Profile
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Order Items</h2>
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-4 pb-4 border-b border-gray-200 last:border-0"
              >
                <img
                  src={item.products.image_url}
                  alt={item.products.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {item.products.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                  ₹{Number(item.products.price)} x {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                   ₹{Number((item.products.price * item.quantity))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Order Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>Total Amount</span>
              <span className="font-semibold">
               ₹{Number(getTotalAmount())}
              </span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Delivery Charge</span>
              <span className="font-semibold">₹{Number(DELIVERY_CHARGE)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span className="font-semibold">-₹{Number(DISCOUNT)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">
                  Final Amount
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  ₹{Number(getFinalAmount())}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={placeOrder}
            disabled={placing || !profile?.address || !profile?.phone}
            className="w-full mt-6 bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {placing ? 'Placing Order...' : 'PAY & PLACE ORDER'}
          </button>
        </div>
      </main>
    </div>
  );
}
