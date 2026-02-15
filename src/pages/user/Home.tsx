import { useState, useEffect } from 'react';
import { ShoppingCart, User, Search, Mic, Plus, Minus, ReceiptText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Product, CartItem, OrderItem, Order } from '../../lib/supabase';
import VoiceToOrderModal from '../user/VoiceToOrderModel';


type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills' | 'createOrder' | 'adminOrder';

interface HomeProps {
  adminMode?: boolean;
  orderId?: string;
  onNavigate?: (page: Page, id?: string) => void;
}

type OrderItemWithProduct = OrderItem & { products: Product };

export default function Home({ adminMode = false, orderId, onNavigate }: HomeProps) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);


  const navigate = onNavigate ?? (() => { });
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);


  useEffect(() => {
    fetchProducts();
    if (!adminMode) {
      fetchCartItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (adminMode && orderId) {
      fetchOrderDetails();
      fetchOrderItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMode, orderId]);

  useEffect(() => {
    let filtered = products;
  
    // ✅ Category Filter
    if (selectedCategory) {
      filtered = filtered.filter(
        (p) =>
          p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
  
    // ✅ Search Filter (Name + ID)
    const query = searchQuery.trim().toLowerCase();
  
    if (query) {
      const numericQuery = query.replace(/[^\d]/g, "");
  
      filtered = filtered.filter((product) => {
        // Match Name
        const matchName = product.name
          ?.toLowerCase()
          .includes(query);
  
        // Match Item ID
        const matchId =
          numericQuery &&
          product.item_id !== undefined &&
          product.item_id !== null &&
          String(product.item_id).includes(numericQuery);
  
        return matchName || matchId;
      });
    }
  
    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  // Get unique categories from products
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
  ).sort();

  useEffect(() => {
    fetchProducts();
    if (!adminMode) fetchCartItems();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartItems = async () => {
    if (adminMode) return;
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', profile?.id);
      if (error) throw error;
      setCartItems(data || []);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    }
  };

  const fetchOrderItems = async () => {
    if (!adminMode || !orderId) return;
    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          products (*)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderItems((data as OrderItemWithProduct[]) || []);
    } catch (error) {
      console.error('Error fetching order items:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  const fetchOrderDetails = async () => {
    if (!adminMode || !orderId) return;
    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrderDetails(data as Order);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 1;
      const newQuantity = Math.max(1, current + delta);
      return { ...prev, [productId]: newQuantity };
    });
  };

  const addToCart = async (product: Product) => {
    try {
      const quantity = quantities[product.id] || 1;

      // 🔴 ADMIN ORDER FLOW (NEW)
      if (adminMode && orderId) {
        const { error } = await supabase.from("order_items").insert([
          {
            order_id: orderId,
            product_id: product.id,
            quantity,
            price: product.price,
            subtotal: product.price * quantity,
          },
        ]);

        if (error) throw error;

        setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
        await fetchOrderItems();
        await fetchOrderDetails();
        return;
      }

      // 🟢 USER CART FLOW (EXISTING CODE)
      const existingItem = cartItems.find(
        (item) => item.product_id === product.id
      );

      if (existingItem) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + quantity })
          .eq("id", existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert([
          {
            user_id: profile?.id,
            product_id: product.id,
            quantity,
          },
        ]);

        if (error) throw error;
      }

      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
      await fetchCartItems();
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("Failed to add to cart");
    }
  };

  const calculateAdminTotals = () => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + (item.subtotal ?? item.price * item.quantity),
      0
    );
    const deliveryCharge = orderDetails?.delivery_charge ?? 0;
    const discount = orderDetails?.discount ?? 0;
    const finalAmount = subtotal + deliveryCharge - discount;
    return { subtotal, deliveryCharge, discount, finalAmount };
  };


  const finalizeAdminOrder = async () => {
    if (!adminMode || !orderId || orderItems.length === 0) {
      alert('Add at least one item before generating the bill.');
      return;
    }

    setFinalizing(true);

    try {
      const { subtotal, finalAmount } = calculateAdminTotals();

      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({
          total_amount: subtotal,
          final_amount: finalAmount,
          status: 'pending',
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error || !updatedOrder) {
        throw error || new Error('Failed to update order');
      }

      setOrderDetails(updatedOrder as Order);

      alert('Order saved and bill generated');

      // ✅ Redirect AFTER successful save
      navigate('admin');

    } catch (error) {
      console.error('Error finalizing admin order:', error);
      alert('Failed to finalize order');
    } finally {
      setFinalizing(false);
    }
  };


  const addVoiceItemsToCart = async (
    items: { product: Product; quantity: number }[]
  ) => {
    for (const item of items) {
      const existingItem = cartItems.find(
        (c) => c.product_id === item.product.id
      );

      if (existingItem) {
        await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + item.quantity })
          .eq('id', existingItem.id);
      } else {
        await supabase.from('cart_items').insert([
          {
            user_id: profile?.id,
            product_id: item.product.id,
            quantity: item.quantity,
          },
        ]);
      }
    }

    await fetchCartItems();
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10 ">
        <div className='bg-white h-8 w-full'></div>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Hello,</p>
                <p className="font-semibold text-gray-900">{profile?.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => { setVoiceOpen(true); }}
                title="Voice to Order"
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-2 py-2 sm:px-4 sm:py-2 rounded-full sm:rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                <Mic className="h-5 w-5" />
                <span className="hidden sm:inline">Voice to Order</span>
              </button>


              <button
                onClick={() => navigate('bills')}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <ReceiptText className="h-6 w-6 text-gray-700" />
              </button>

              <button
                onClick={() => navigate('profile')}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <User className="h-6 w-6 text-gray-700" />
              </button>
              <button
                onClick={() => navigate('cart')}
                className="relative p-2 hover:bg-gray-100 rounded-full transition"
              >
                <ShoppingCart className="h-6 w-6 text-gray-700" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="relative">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search by Product ID or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <button className="absolute right-3 top-1/2 -translate-y-1/2">
              <Mic className="text-gray-400" />
            </button>

          </div>

          {/* Categories Section */}
          {categories.length > 0 && (
            <div className="w-full overflow-x-auto">
              <div className="flex gap-3 whitespace-nowrap px-2 py-3">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition ${selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {adminMode && orderId && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Admin Order</p>
                <p className="text-lg font-semibold text-gray-900">
                  {orderDetails?.customer_name || 'Customer'} {orderDetails?.customer_phone ? `(${orderDetails.customer_phone})` : ''}
                </p>
                <p className="text-sm text-gray-500">
                  {orderDetails?.customer_address || 'Address not provided'}
                </p>
                <p className="text-sm text-gray-500">Order ID: {orderId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Items</p>
                <p className="text-2xl font-bold text-blue-600">{orderItems.length}</p>
                <p className="text-sm text-gray-500">
                  Total ₹{calculateAdminTotals().finalAmount.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-3 max-h-48 overflow-auto divide-y">
              {orderItems.length === 0 && (
                <p className="text-sm text-gray-500">No items yet. Add products below.</p>
              )}
              {orderItems.map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.products?.name}</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{Number(item.subtotal ?? item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => { fetchOrderItems(); fetchOrderDetails(); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
              <button
                onClick={finalizeAdminOrder}
                disabled={finalizing || adminLoading}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {finalizing ? 'Saving...' : 'Generate Bill'}
              </button>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {selectedCategory ? `${selectedCategory} Products` : 'All Products'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
          {filteredProducts.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 py-6">
              No products match your search.
            </p>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {product.name}
                    </h3>

                    {product.item_id != null && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100">
                        Item ID: {product.item_id}
                      </span>
                    )}
                  </div>

                  <p className="text-lg font-bold text-blue-600 mb-2">
                    ₹{product.price}
                  </p>

                  <p className="text-sm text-gray-600 mb-4">
                    Stock: {product.stock}
                  </p>

                  <button
                    onClick={() => addToCart(product)}
                    disabled={!profile || product.stock === 0}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <VoiceToOrderModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        products={products}
        onAddItems={addVoiceItemsToCart}
      />

    </div>
  );
}



// import { useState, useEffect } from 'react';
// import { ShoppingCart, User, Search, Mic, ReceiptText } from 'lucide-react';
// import { useAuth } from '../../context/AuthContext';
// import { supabase, Product, CartItem, OrderItem, Order } from '../../lib/supabase';
// import VoiceToOrderModal from '../user/VoiceToOrderModel';

// type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills' | 'createOrder' | 'adminOrder';

// interface HomeProps {
//   adminMode?: boolean;
//   orderId?: string;
//   onNavigate?: (page: Page, id?: string) => void;
// }

// type OrderItemWithProduct = OrderItem & { products: Product };

// export default function Home({ adminMode = false, orderId, onNavigate }: HomeProps) {

//   const { profile } = useAuth();

//   const [products, setProducts] = useState<Product[]>([]);
//   const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
//   const [cartItems, setCartItems] = useState<CartItem[]>([]);
//   const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
//   const [orderDetails, setOrderDetails] = useState<Order | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [voiceOpen, setVoiceOpen] = useState(false);

//   const navigate = onNavigate ?? (() => { });
//   const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

//   /* ---------------- FETCH DATA ---------------- */

//   useEffect(() => {
//     fetchProducts();
//     if (!adminMode) fetchCartItems();
//   }, []);

//   useEffect(() => {
//     if (adminMode && orderId) {
//       fetchOrderDetails();
//       fetchOrderItems();
//     }
//   }, [adminMode, orderId]);

//   /* ---------------- SEARCH + CATEGORY FILTER ---------------- */

//   useEffect(() => {

//     let filtered = [...products];

//     // CATEGORY FILTER
//     if (selectedCategory) {
//       filtered = filtered.filter(
//         p => p.category?.toLowerCase() === selectedCategory.toLowerCase()
//       );
//     }

//     // SEARCH FILTER (ID + NAME)
//     const query = searchQuery.trim().toLowerCase();

//     if (query) {

//       const numericQuery = query.replace(/[^\d]/g, '');

//       filtered = filtered.filter(product => {

//         const matchName =
//           product.name?.toLowerCase().includes(query);

//         const matchId =
//           numericQuery &&
//           product.item_id != null &&
//           String(product.item_id).includes(numericQuery);

//         return matchName || matchId;
//       });
//     }

//     setFilteredProducts(filtered);

//   }, [products, selectedCategory, searchQuery]);

//   /* ---------------- API CALLS ---------------- */

//   const fetchProducts = async () => {
//     try {
//       const { data, error } = await supabase
//         .from('products')
//         .select('*')
//         .order('created_at', { ascending: false });

//       if (error) throw error;

//       setProducts(data || []);
//       setFilteredProducts(data || []);

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchCartItems = async () => {
//     if (adminMode) return;

//     const { data } = await supabase
//       .from('cart_items')
//       .select('*')
//       .eq('user_id', profile?.id);

//     setCartItems(data || []);
//   };

//   const fetchOrderItems = async () => {
//     if (!adminMode || !orderId) return;

//     const { data } = await supabase
//       .from('order_items')
//       .select(`*, products (*)`)
//       .eq('order_id', orderId);

//     setOrderItems((data as OrderItemWithProduct[]) || []);
//   };

//   const fetchOrderDetails = async () => {
//     if (!adminMode || !orderId) return;

//     const { data } = await supabase
//       .from('orders')
//       .select('*')
//       .eq('id', orderId)
//       .single();

//     setOrderDetails(data as Order);
//   };

//   const addToCart = async (product: Product) => {

//     const existing = cartItems.find(c => c.product_id === product.id);

//     if (existing) {
//       await supabase
//         .from('cart_items')
//         .update({ quantity: existing.quantity + 1 })
//         .eq('id', existing.id);
//     } else {
//       await supabase.from('cart_items').insert([{
//         user_id: profile?.id,
//         product_id: product.id,
//         quantity: 1
//       }]);
//     }

//     fetchCartItems();
//   };

//   /* ---------------- LOADING ---------------- */

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         Loading...
//       </div>
//     );
//   }

//   /* ---------------- UI ---------------- */

//   const categories = Array.from(
//     new Set(products.map(p => p.category).filter(Boolean))
//   );

//   return (
//     <div className="min-h-screen bg-gray-50">

//       {/* HEADER */}
//       <header className="bg-white shadow-sm sticky top-0 z-10">

//         <div className="max-w-7xl mx-auto px-4 py-4">

//           {/* TOP BAR */}
//           <div className="flex justify-between mb-4">

//             <div className="flex items-center gap-3">
//               <User />
//               <div>
//                 <p>Hello</p>
//                 <p className="font-semibold">{profile?.name}</p>
//               </div>
//             </div>

//             <div className="flex gap-4">

//               <button onClick={() => setVoiceOpen(true)}>
//                 <Mic />
//               </button>

//               <button onClick={() => navigate('bills')}>
//                 <ReceiptText />
//               </button>

//               <button onClick={() => navigate('cart')}>
//                 <ShoppingCart />
//                 {cartItemCount > 0 && <span>{cartItemCount}</span>}
//               </button>

//             </div>
//           </div>

//           {/* SEARCH BOX */}
//           <div className="relative">

//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

//             <input
//               type="text"
//               placeholder="Search by Product ID or Name..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               className="w-full pl-10 pr-10 py-3 border rounded-lg"
//             />

//           </div>

//           {/* CATEGORY UI */}
//           <div className="flex gap-3 py-3 overflow-x-auto">

//             <button
//               onClick={() => setSelectedCategory(null)}
//               className={selectedCategory === null ? "bg-blue-600 text-white px-4 py-2 rounded-full" : "bg-gray-200 px-4 py-2 rounded-full"}
//             >
//               All
//             </button>

//             {categories.map(cat => (
//               <button
//                 key={cat}
//                 onClick={() => setSelectedCategory(cat)}
//                 className={selectedCategory === cat ? "bg-blue-600 text-white px-4 py-2 rounded-full" : "bg-gray-200 px-4 py-2 rounded-full"}
//               >
//                 {cat}
//               </button>
//             ))}
//           </div>

//         </div>
//       </header>

//       {/* PRODUCTS GRID */}
//       <main className="max-w-7xl mx-auto px-4 py-6">

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

//           {filteredProducts.length === 0 ? (
//             <p>No products found</p>
//           ) : (
//             filteredProducts.map(product => (

//               <div key={product.id} className="bg-white rounded-xl shadow-md p-4">

//                 <img src={product.image_url} className="h-40 w-full object-contain" />

//                 <h3 className="font-semibold mt-2">{product.name}</h3>

//                 <p className="text-sm">Item ID: {product.item_id}</p>

//                 <p className="font-bold text-blue-600">₹{product.price}</p>

//                 <button
//                   onClick={() => addToCart(product)}
//                   className="w-full bg-blue-600 text-white py-2 mt-2 rounded-lg"
//                 >
//                   Add to Cart
//                 </button>

//               </div>
//             ))
//           )}

//         </div>
//       </main>

//       <VoiceToOrderModal
//         open={voiceOpen}
//         onClose={() => setVoiceOpen(false)}
//         products={products}
//         onAddItems={() => { }}
//       />

//     </div>
//   );
// }