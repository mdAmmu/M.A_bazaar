// import { useState, useEffect } from 'react';
// import { ArrowLeft, Trash2, ShoppingBag } from 'lucide-react';
// import { useAuth } from '../../context/AuthContext';
// import { supabase, CartItem, Product } from '../../lib/supabase';

// type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills';

// interface CartProps {
//   onNavigate: (page: Page, data?: unknown) => void;
// }

// interface CartItemWithProduct extends CartItem {
//   products: Product;
// }

// export default function Cart({ onNavigate }: CartProps) {
//   const { profile } = useAuth();
//   const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetchCartItems();
//   }, []);

//   const fetchCartItems = async () => {
//     try {
//       const { data, error } = await supabase
//         .from('cart_items')
//         .select(`
//           *,
//           products (*)
//         `)
//         .eq('user_id', profile?.id);

//       if (error) throw error;
//       setCartItems((data as CartItemWithProduct[]) || []);
//     } catch (error) {
//       console.error('Error fetching cart items:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const updateQuantity = async (itemId: string, newQuantity: number) => {
//     if (newQuantity < 1) return;

//     try {
//       const { error } = await supabase
//         .from('cart_items')
//         .update({ quantity: newQuantity })
//         .eq('id', itemId);

//       if (error) throw error;
//       await fetchCartItems();
//     } catch (error) {
//       console.error('Error updating quantity:', error);
//     }
//   };

//   const removeItem = async (itemId: string) => {
//     try {
//       const { error } = await supabase
//         .from('cart_items')
//         .delete()
//         .eq('id', itemId);

//       if (error) throw error;
//       await fetchCartItems();
//     } catch (error) {
//       console.error('Error removing item:', error);
//     }
//   };

//   const getTotalAmount = () => {
//     return cartItems.reduce(
//       (sum, item) => sum + item.products.price * item.quantity,
//       0
//     );
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <header className="bg-white shadow-sm">
//         <div className="max-w-4xl mx-auto px-4 py-4">
//           <button
//             onClick={() => onNavigate('home')}
//             className="flex items-center text-gray-700 hover:text-gray-900"
//           >
//             <ArrowLeft className="h-5 w-5 mr-2" />
//             Back
//           </button>
//         </div>
//       </header>

//       <main className="max-w-4xl mx-auto px-4 py-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

//         {cartItems.length === 0 ? (
//           <div className="bg-white rounded-2xl shadow-md p-12 text-center">
//             <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
//             <h2 className="text-2xl font-semibold text-gray-900 mb-2">
//               Your cart is empty
//             </h2>
//             <p className="text-gray-600 mb-6">
//               Add some products to get started!
//             </p>
//             <button
//               onClick={() => onNavigate('home')}
//               className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
//             >
//               Continue Shopping
//             </button>
//           </div>
//         ) : (
//           <div className="space-y-4">
//             {cartItems.map((item) => (
//               <div
//                 key={item.id}
//                 className="bg-white rounded-xl shadow-md p-4 flex items-center space-x-4"
//               >
//                 <img
//                   src={item.products.image_url}
//                   alt={item.products.name}
//                   className="w-24 h-24 object-cover rounded-lg"
//                 />
//                 <div className="flex-1">
//                   <h3 className="font-semibold text-gray-900">
//                     {item.products.name}
//                   </h3>
//                   <p className="text-sm text-gray-600 mt-1">
//                     ₹{item.products.price.toFixed(2)} each
//                   </p>
//                   <div className="flex items-center mt-3 space-x-3">
//                     <button
//                       onClick={() => updateQuantity(item.id, item.quantity - 1)}
//                       className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
//                     >
//                       -
//                     </button>
//                     <span className="font-semibold w-8 text-center">
//                       {item.quantity}
//                     </span>
//                     <button
//                       onClick={() => updateQuantity(item.id, item.quantity + 1)}
//                       className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
//                     >
//                       +
//                     </button>
//                   </div>
//                 </div>
//                 <div className="text-right">
//                   <p className="text-xl font-bold text-blue-600">
//                     ₹{Number((item.products.price * item.quantity).toFixed(2))}
//                   </p>
//                   <button
//                     onClick={() => removeItem(item.id)}
//                     className="mt-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
//                   >
//                     <Trash2 className="h-5 w-5" />
//                   </button>
//                 </div>
//               </div>
//             ))}

//             <div className="bg-white rounded-xl shadow-md p-6 mt-6">
//               <div className="flex justify-between items-center mb-6">
//                 <span className="text-lg font-semibold text-gray-900">
//                   Total Amount:
//                 </span>
//                 <span className="text-2xl font-bold text-blue-600">
//                   ₹{Number(getTotalAmount().toFixed(2))}
//                 </span>
//               </div>
//               <button
//                 onClick={() => onNavigate('checkout', { cartItems })}
//                 className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition"
//               >
//                 Proceed To Buy
//               </button>
//             </div>
//           </div>
//         )}
//       </main>
//     </div>
//   );
// }


import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CartItem, Product, OrderItem, Order } from '../../lib/supabase';

type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills' | 'createOrder' | 'adminOrder';

interface CartProps {
  onNavigate: (page: Page, data?: unknown) => void;
  adminMode?: boolean;
  orderId?: string;
}

interface CartItemWithProduct extends CartItem {
  products: Product;
}

type OrderItemWithProduct = OrderItem & { products: Product };

export default function Cart({ onNavigate, adminMode = false, orderId }: CartProps) {
  const { profile } = useAuth();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminMode && orderId) {
      fetchOrderItems();
      fetchOrderDetails();
    } else {
      fetchCartItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMode, orderId]);

  const fetchOrderItems = async () => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`*, products(*)`)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setOrderItems((data as OrderItemWithProduct[]) || []);
    } catch (error) {
      console.error('Error fetching order items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (error) throw error;
      setOrderDetails(data as Order);
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  const fetchCartItems = async () => {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`*, products(*)`)
        .eq('user_id', profile?.id);
      if (error) throw error;
      setCartItems((data as CartItemWithProduct[]) || []);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (adminMode) return; // prevent edits in admin order view here
    if (newQuantity < 1) return;
    try {
      const { error } = await supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', itemId);
      if (error) throw error;
      await fetchCartItems();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const removeItem = async (itemId: string) => {
    if (adminMode) return; // prevent deletes in admin order view here
    try {
      const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
      if (error) throw error;
      await fetchCartItems();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const getTotalAmount = () => {
    if (adminMode) {
      return orderItems.reduce(
        (sum, item) => sum + (item.subtotal ?? item.price * item.quantity),
        0
      );
    }
    return cartItems.reduce((sum, item) => sum + item.products.price * item.quantity, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasItems = adminMode ? orderItems.length > 0 : cartItems.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => onNavigate(adminMode ? 'admin' : 'home')}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          {adminMode && orderDetails && (
            <div className="text-right text-sm text-gray-600">
              <div className="font-semibold text-gray-900">
                {orderDetails.customer_name || 'Customer'} ({orderDetails.customer_phone || ''})
              </div>
              <div>Order ID: {orderDetails.id}</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {adminMode ? 'Admin Order Items' : 'Shopping Cart'}
        </h1>

        {!hasItems ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center">
            <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {adminMode ? 'No items in this order' : 'Your cart is empty'}
            </h2>
          </div>
        ) : (
          <div className="space-y-4">
            {(adminMode ? orderItems : cartItems).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-md p-4 flex items-center space-x-4"
              >
                <img
                  src={item.products.image_url}
                  alt={item.products.name}
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {item.products.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    ₹{item.products.price.toFixed(2)} each
                  </p>
                  <div className="flex items-center mt-3 space-x-3">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <span className="font-semibold w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-600">
                    ₹{Number((item.products.price * item.quantity).toFixed(2))}
                  </p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasItems && (
          <div className="mt-8 bg-white rounded-xl shadow-md p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="text-2xl font-bold text-gray-900">₹{getTotalAmount().toFixed(2)}</p>
            </div>
            {!adminMode && (
              <button
                onClick={() => onNavigate('checkout')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Proceed to Checkout
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}