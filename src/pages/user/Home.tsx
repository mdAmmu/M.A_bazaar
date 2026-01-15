import { useState, useEffect } from 'react';
import { ShoppingCart, User, Search, Mic, Plus, Minus ,ReceiptText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Product, CartItem } from '../../lib/supabase';

type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills';

interface HomeProps {
  onNavigate: (page: Page) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchCartItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let filtered = products;

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(
        (product) => product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, products]);

  // Get unique categories from products
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
  ).sort();

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartItems = async () => {
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
      const existingItem = cartItems.find((item) => item.product_id === product.id);

      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').insert([
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
      alert('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    }
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
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
                onClick={() => onNavigate('bills')}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <ReceiptText  className="h-6 w-6 text-gray-700" />
              </button>

              <button
                onClick={() => onNavigate('profile')}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <User className="h-6 w-6 text-gray-700" />
              </button>
              <button
                onClick={() => onNavigate('cart')}
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition">
              <Mic className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Categories Section */}
          {categories.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    selectedCategory === null
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
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                      selectedCategory === category
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {selectedCategory ? `${selectedCategory} Products` : 'All Products'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition"
            >
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                <p className="text-2xl font-bold text-blue-600 mb-4">
                  ₹{Number(product.price.toFixed(2))}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Quantity:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(product.id, -1)}
                      className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    >
                      <Minus className="h-4 w-4 text-gray-700" />
                    </button>
                    <span className="w-8 text-center font-semibold">
                      {quantities[product.id] || 1}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, 1)}
                      className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                    >
                      <Plus className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => addToCart(product)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition mb-2"
                >
                  ADD TO CART
                </button>

                
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </main>
    </div>
  );
}
