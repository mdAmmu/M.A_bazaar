import { useEffect, useState } from "react";
import { Package, Users, ShoppingCart, MapPin, Trash2, ArrowLeft, Minus, Plus, ChevronUp, ChevronDown, Calendar, DollarSign, Navigation, Search, LogOut } from "lucide-react";
import { supabase, Product } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

// ---------------- TYPES ----------------
type Customer = {
    id: string;
    name: string;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
};

type CartItem = {
    product: Product;
    qty: number;
};

type OrderWithItems = {
    id: string;
    total_amount: number;
    final_amount: number;
    status: string;
    created_at: string;
    customer_id: string;
    customers?: Customer;
    order_items?: Array<{
        id: string;
        quantity: number;
        price: number;
        subtotal: number;
        delivery_charge: number;
        products: Product;
    }>;
};

// ---------------- COMPONENT ----------------
export default function EmployeeDashboard() {
    const { profile, signOut } = useAuth();
    const [tab, setTab] = useState<"products" | "customers" | "orders" | "cart">("products");
    const [employeeId, setEmployeeId] = useState<string | null>(null);

    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    

    // New customer form
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [locationStatus, setLocationStatus] = useState<string>("");
    const [addingCustomer, setAddingCustomer] = useState(false);
    const [customerTab, setCustomerTab] = useState<"existing" | "new">("existing");
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [customerSearchQuery, setCustomerSearchQuery] = useState("");
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);


    // ---------------- CATEGORIES ----------------
    useEffect(() => {
        const categories = Array.from(
            new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
        ).sort();
        setCategories(categories);
    }, [products]);

    useEffect(() => {
        let filtered = products;

        // ✅ Category filter
        if (selectedCategory) {
            filtered = filtered.filter(
                (p) =>
                    p.category?.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        // ✅ Search (Item ID OR Name)
        const raw = productSearchQuery.trim().toLowerCase();
        if (raw) {
            const numericQ = raw.replace(/[^\d]/g, "");
            const targetId = numericQ ? parseInt(numericQ, 10) : NaN;

            filtered = filtered.filter((p) => {
                const matchesName =
                    p.name?.toLowerCase().includes(raw);

                const matchesId =
                    !Number.isNaN(targetId) &&
                    p.item_id !== undefined &&
                    p.item_id === targetId;

                return matchesName || matchesId;
            });
        }

        setFilteredProducts(filtered);
    }, [products, selectedCategory, productSearchQuery]);


    // ---------------- AUTH ----------------
    useEffect(() => {
        const getUser = async () => {
            const { data } = await supabase.auth.getUser();
            if (data?.user) setEmployeeId(data.user.id);
        };
        getUser();
    }, []);

    // ---------------- FETCH DATA ----------------
    useEffect(() => {
        if (employeeId) {
            fetchProducts();
            fetchCustomers();
            fetchOrders();
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId]);

    const toggleOrder = (orderId: string) => {
        setExpandedOrders((prev) => {
            const next = new Set(prev);
            next.has(orderId) ? next.delete(orderId) : next.add(orderId);
            return next;
        });
    };

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from("products")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    const fetchCustomers = async () => {
        if (!employeeId) return;
        try {
            const { data, error } = await supabase
                .from("customers")
                .select("*")
                .eq("employee_id", employeeId)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching customers:", error);
                throw error;
            }
            setCustomers(data || []);
        } catch (error) {
            console.error("Error fetching customers:", error);
            // Optionally show an error to the user
        }
    };

    const fetchOrders = async () => {
        if (!employeeId) return;
        try {
            const { data, error } = await supabase
                .from("orders")
                .select(`
          *,
          customers (*),
          order_items (
            id,
            quantity,
            price,
            subtotal,
            products (*)
          )
        `)
                .eq("employee_id", employeeId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            setOrders((data as OrderWithItems[]) || []);
        } catch (error) {
            console.error("Error fetching orders:", error);
        }
    };

    // ---------------- LOCATION ----------------
    const setCurrentLocation = () => {
        setLocationStatus("Getting location...");
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLat(pos.coords.latitude);
                setLng(pos.coords.longitude);
                setLocationStatus("Location captured successfully!");
                setTimeout(() => setLocationStatus(""), 3000);
            },
            (error) => {
                setLocationStatus(`Error: ${error.message}`);
                setTimeout(() => setLocationStatus(""), 3000);
            }
        );
    };

    // ---------------- CUSTOMER ----------------
    const addCustomer = async () => {
        if (!employeeId) {
            alert("Employee ID not found. Please log in again.");
            return;
        }
        if (!name.trim() || !phone.trim() || !address.trim()) {
            alert("Please fill in all required fields");
            return;
        }

        setAddingCustomer(true);
        try {
            // Insert and return the created customer in one operation
            const { data, error } = await supabase
                .from("customers")
                .insert([
                    {
                        name: name.trim(),
                        phone: phone.trim(),
                        address: address.trim(),
                        latitude: lat,
                        longitude: lng,
                        employee_id: employeeId,
                    },
                ])
                .select()  // This returns the inserted row(s)
                .single(); // Get the single inserted row

            if (error) {
                console.error("Supabase error:", error);
                alert(`Failed to add customer: ${error.message}`);
                return;
            }

            if (!data) {
                alert("Customer was created but could not be retrieved. Please refresh the page.");
                return;
            }

            // Reset form
            setName("");
            setPhone("");
            setAddress("");
            setLat(null);
            setLng(null);
            setLocationStatus("");

            // Refresh customers list
            await fetchCustomers();

            // Use the returned data directly
            setActiveCustomer(data);
            setTab("products");
            alert("Customer added successfully!");
        } catch (error) {
            console.error("Error adding customer:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            alert(`Failed to add customer: ${errorMessage}`);
        } finally {
            setAddingCustomer(false);
        }
    };



    const selectCustomer = (customer: Customer) => {
        setActiveCustomer(customer);
        setTab("products");
    };

    const deleteCustomer = async (customerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this customer?")) return;
        try {
            const { error } = await supabase.from("customers").delete().eq("id", customerId);
            if (error) throw error;
            if (activeCustomer?.id === customerId) setActiveCustomer(null);
            await fetchCustomers();
        } catch (err) {
            console.error("Error deleting customer:", err);
            alert("Failed to delete customer.");
        }
    };

    // ---------------- CART ----------------
    const addToCart = (product: Product) => {
        if (!activeCustomer) {
            alert("Please select a customer first from the Customers page");
            setTab("customers");
            return;
        }

        setCart((prev) => {
            const existing = prev.find((p) => p.product.id === product.id);
            if (existing) {
                return prev.map((p) =>
                    p.product.id === product.id ? { ...p, qty: p.qty + 1 } : p
                );
            }
            return [...prev, { product, qty: 1 }];
        });
    };

    const updateQty = (id: string, qty: number) => {
        if (qty < 1) return;
        setCart((prev) =>
            prev.map((p) => (p.product.id === id ? { ...p, qty } : p))
        );
    };

    const removeFromCart = (id: string) => {
        setCart((prev) => prev.filter((p) => p.product.id !== id));
    };

    const totalAmount = cart.reduce(
        (sum, i) => sum + i.qty * i.product.price,
        0
    );

    // ---------------- ORDER ---------------- 
    const deliveryCharge = 20;
    const finalAmount = totalAmount + deliveryCharge;

    const placeOrder = async () => {
        if (!employeeId || !activeCustomer || cart.length === 0) {
            alert("Please select a customer and add items to cart");
            return;
        }

        try {
            // Create order
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert([
                    {
                        employee_id: employeeId,
                        customer_id: activeCustomer.id,
                        total_amount: totalAmount,
                        delivery_charge: deliveryCharge,
                        discount: 0,
                        final_amount: finalAmount,
                        status: "pending",
                    },
                ])
                .select()
                .single();

            if (orderError) throw orderError;

            // Create order items
            const orderItems = cart.map((c) => ({
                order_id: order.id,
                product_id: c.product.id,
                quantity: c.qty,
                price: c.product.price,
                subtotal: c.qty * c.product.price,
            }));

            const { error: itemsError } = await supabase
                .from("order_items")
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Clear cart and reset
            setCart([]);
            // Don't clear active customer - they might want to place another order
            await fetchOrders();

            // Navigate to orders tab to show the new order
            setTab("orders");
            alert("Order placed successfully!");

        } catch (error) {
            console.error("Error placing order:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            const errorCode = (error as { code?: string })?.code || "";
            alert(`Failed to place order: ${errorMessage}\n\nError Code: ${errorCode}\n\nIf you see "row-level security policy", please run the FIX_ORDER_RLS.sql file in Supabase Dashboard.`);
        }
    };

    // delete order button function
    const deleteOrder = async (orderId: string) => {
        const isConfirmed = window.confirm(
            'Are you sure you want to delete this order? This action cannot be undone and will also delete all order items.'
        );
        if (!isConfirmed) return;

        try {
            // Delete order items first (due to foreign key constraint)
            const { error: itemsError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            if (itemsError) {
                console.error('Error deleting order items:', itemsError);
                alert(`Failed to delete order items: ${itemsError.message}`);
                return;
            }

            // Then delete the order
            const { error: orderError } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (orderError) {
                console.error('Error deleting order:', orderError);
                alert(`Failed to delete order: ${orderError.message}`);
                return;
            }

            await fetchOrders();
            await calculateStats();
            // alert('Order deleted successfully');
        } catch (err) {
            console.error('Error deleting order:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            alert(`Failed to delete order: ${errorMessage}`);
        }
    };


    // ---------------- UI ----------------
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }
    const handleLogout = async () => {
        if (confirm('Are you sure you want to logout?')) {
          await signOut();
        }
      };

    return (
        <div className="min-h-screen bg-gray-50 ">
            {/* Header */}
            <div className="bg-white shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-900">Employee Dashboard</h1>
                        <div className="flex items-center gap-4">
                            {profile && (
                                <div className="text-sm text-gray-600 flex items-center gap-2">
                                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-lg font-semibold">
                                        {profile?.name}
                                    </div>
                                </div>
                            )}
                            {/* Cart Icon with Badge */}
                            <button
                                onClick={handleLogout}
                                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setTab("cart")}
                                className="relative bg-white border border-gray-300 rounded-lg p-2 hover:bg-gray-50 transition"
                            >
                                <ShoppingCart className="h-6 w-6 text-gray-700" />
                                {cart.length > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                                        {cart.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-md mb-6">
                    <div className="flex overflow-x-auto whitespace-nowrap border-b border-gray-200 scrollbar-hide">
                        <button
                            onClick={() => setTab("products")}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${tab === "products"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <Package className="h-5 w-5" />
                            Products
                        </button>
                        <button
                            onClick={() => setTab("customers")}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${tab === "customers"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <Users className="h-5 w-5" />
                            Customers
                        </button>
                        <button
                            onClick={() => setTab("orders")}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${tab === "orders"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <ShoppingCart className="h-5 w-5" />
                            Orders
                        </button>
                    </div>
                </div>

                {/* Active Customer Banner */}
                {activeCustomer && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Customer</p>
                                <p className="font-semibold text-gray-900">{activeCustomer.name}</p>
                                <p className="text-sm text-gray-600">{activeCustomer.phone}</p>
                            </div>
                            <button
                                onClick={() => setActiveCustomer(null)}
                                className="text-sm text-red-600 hover:text-red-700"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* Products Tab */}
                {tab === "products" && (
                    <div>
                        {!activeCustomer && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-yellow-800">
                                    ⚠️ Please select a customer from the Customers page before adding products to cart.
                                </p>
                            </div>
                        )}

                        {products.length > 0 && (
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by Item ID..."
                                    value={productSearchQuery}
                                    onChange={(e) => setProductSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        )}
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
                                                ₹{product.price.toFixed(2)}
                                            </p>

                                            <p className="text-sm text-gray-600 mb-4">
                                                Stock: {product.stock}
                                            </p>

                                            <button
                                                onClick={() => addToCart(product)}
                                                disabled={!activeCustomer || product.stock === 0}
                                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                                            >
                                                Add to Cart
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>



                    </div>
                )}

                {/* Customers Tab */}
                {tab === "customers" && (
                    <div className="space-y-6">
                        {/* Tabs */}
                        <div className="flex gap-2 border-b">
                            <button
                                onClick={() => setCustomerTab("existing")}
                                className={`px-4 py-2 font-semibold border-b-2 transition ${customerTab === "existing"
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Existing Customers
                            </button>
                            <button
                                onClick={() => setCustomerTab("new")}
                                className={`px-4 py-2 font-semibold border-b-2 transition ${customerTab === "new"
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Add New Customer
                            </button>
                        </div>

                        {/* ================= Existing Customers ================= */}
                        {customerTab === "existing" && (
                            <div className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">
                                    My Customers
                                </h2>

                                {customers.length > 0 && (
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, phone, or address..."
                                            value={customerSearchQuery}
                                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                )}

                                {customers.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600">
                                            No customers yet. Add your first customer.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {(() => {
                                            const q = customerSearchQuery.trim().toLowerCase();
                                            const filtered = q
                                                ? customers.filter(
                                                    (c) =>
                                                        c.name.toLowerCase().includes(q) ||
                                                        c.phone.toLowerCase().includes(q) ||
                                                        c.address.toLowerCase().includes(q)
                                                )
                                                : customers;
                                            return filtered.length === 0 ? (
                                                <p className="col-span-full text-center text-gray-500 py-6">No customers match your search.</p>
                                            ) : (
                                                filtered.map((customer) => (
                                                    <div
                                                        key={customer.id}
                                                        onClick={() => selectCustomer(customer)}
                                                        className={`border rounded-lg p-4 cursor-pointer transition ${activeCustomer?.id === customer.id
                                                            ? "border-blue-500 bg-blue-50"
                                                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h3 className="font-semibold text-gray-900">
                                                                    {customer.name}
                                                                </h3>
                                                                <p className="text-sm text-gray-600 mt-1">
                                                                    {customer.phone}
                                                                </p>
                                                                <p className="text-sm text-gray-500 mt-2 line-clamp-2 break-all">
                                                                    {customer.address}
                                                                </p>
                                                                {customer.latitude && customer.longitude && (
                                                                    <p className="text-xs text-green-600 mt-2">
                                                                        📍 GPS location saved
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {activeCustomer?.id === customer.id && (
                                                                <span className="text-blue-600 font-semibold text-sm">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 flex gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    selectCustomer(customer);
                                                                }}
                                                                className="flex-auto bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                                                            >
                                                                Select Customer
                                                            </button>
                                                            {customer.latitude != null && customer.longitude != null && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const url = `https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`;
                                                                        window.open(url, "_blank", "noopener,noreferrer");
                                                                    }}
                                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                                                                    title="Open location in Google Maps"
                                                                >
                                                                    <Navigation className="h-4 w-4" />
                                                                    Locate
                                                                </button>
                                                            )}
                                                            {/* <button
                                                        onClick={(e) => deleteCustomer(customer.id, e)}
                                                        className="flex items-center justify-center p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                                                        title="Delete customer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button> */}
                                                        </div>
                                                    </div>
                                                )));
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ================= Add New Customer ================= */}
                        {customerTab === "new" && (
                            <div className="bg-white rounded-xl shadow-md p-6 max-w-xl">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">
                                    Add New Customer
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Customer Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter customer name"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phone Number *
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="Enter phone number"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Address *
                                        </label>
                                        <textarea
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            rows={3}
                                            placeholder="Enter customer address"
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <button
                                            onClick={setCurrentLocation}
                                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                                        >
                                            <MapPin className="h-5 w-5" />
                                            Set My Current Location
                                        </button>

                                        {locationStatus && (
                                            <p className="mt-2 text-sm text-gray-600">{locationStatus}</p>
                                        )}

                                        {lat && lng && (
                                            <p className="mt-2 text-sm text-green-600">
                                                ✓ Location captured: {lat.toFixed(6)}, {lng.toFixed(6)}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={addCustomer}
                                        disabled={addingCustomer}
                                        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400"
                                    >
                                        {addingCustomer ? "Adding..." : "Add Customer"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}



                {/* Cart Tab */}
                {tab === "cart" && (
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <button
                                onClick={() => setTab("products")}
                                className="flex items-center text-gray-700 hover:text-gray-900"
                            >
                                <ArrowLeft className="h-5 w-5 mr-2" />
                                Back
                            </button>
                            <h2 className="text-2xl font-bold text-gray-900">Cart</h2>
                        </div>

                        {!activeCustomer && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-yellow-800">
                                    ⚠️ Please select a customer from the Customers page before placing an order.
                                </p>
                                <button
                                    onClick={() => setTab("customers")}
                                    className="mt-2 text-blue-600 hover:text-blue-700 font-semibold"
                                >
                                    Go to Customers →
                                </button>
                            </div>
                        )}

                        {activeCustomer && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-green-700" />
                                    <p className="text-green-800 font-semibold">
                                        Shopping for: {activeCustomer.name}
                                    </p>
                                </div>
                            </div>
                        )}

                        {cart.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-md p-12 text-center">
                                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
                                <p className="text-gray-600 mb-6">Add some products to get started!</p>
                                <button
                                    onClick={() => setTab("products")}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Cart Items */}
                                <div className="lg:col-span-2 space-y-4">
                                    <p className="text-sm text-gray-600 mb-4">{cart.length} items in cart</p>
                                    {cart.map((item) => (
                                        <div
                                            key={item.product.id}
                                            className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4"
                                        >
                                            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                                <img
                                                    src={item.product.image_url}
                                                    alt={item.product.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 mb-1">{item.product.name}</h3>
                                                <p className="text-blue-600 font-semibold mb-3">
                                                    ₹{item.product.price.toFixed(2)}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => updateQty(item.product.id, item.qty - 1)}
                                                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </button>
                                                    <span className="font-semibold w-8 text-center">{item.qty}</span>
                                                    <button
                                                        onClick={() => updateQty(item.product.id, item.qty + 1)}
                                                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                    <span className="ml-4 font-semibold text-gray-900">
                                                        ₹{(item.product.price * item.qty).toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => removeFromCart(item.product.id)}
                                                        className="ml-auto p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Order Summary */}
                                <div className="lg:col-span-1">
                                    <div className="bg-white rounded-xl shadow-md p-6 sticky top-4">
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h3>
                                        <div className="space-y-3 mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Subtotal</span>
                                                <span className="font-semibold">₹{totalAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Items</span>
                                                <span className="font-semibold">{cart.length}</span>
                                            </div>
                                            <div className="border-t pt-3 flex justify-between">
                                                <span className="text-lg font-semibold text-gray-900">Total</span>
                                                <span className="text-2xl font-bold text-blue-600">
                                                    ₹{totalAmount.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={placeOrder}
                                            disabled={!activeCustomer}
                                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                                        >
                                            <ShoppingCart className="h-5 w-5" />
                                            Place Order
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* Orders Tab */}
                {tab === "orders" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
                            <p className="text-gray-600">View and manage your orders</p>
                        </div>

                        {orders.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-md p-12 text-center">
                                <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">No orders yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {orders.map((order) => {
                                    const isOpen = expandedOrders.has(order.id);
                                    const customer = order.customers;
                                    const items = order.order_items || [];

                                    return (
                                        <div
                                            key={order.id}
                                            className="bg-white rounded-xl shadow-md overflow-hidden"
                                        >
                                            {/* ===== Order Header (Clickable) ===== */}
                                            <div
                                                onClick={() => toggleOrder(order.id)}
                                                className="cursor-pointer px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <Package className="h-6 w-6 text-blue-600" />
                                                    </div>

                                                    <div>
                                                        <p className="font-semibold text-gray-900">
                                                            {customer?.name || order.id.slice(0, 8)}
                                                        </p>

                                                        <div className="flex gap-4 text-sm text-gray-600 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-4 w-4" />
                                                                {new Date(order.created_at).toLocaleDateString("en-US", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    year: "numeric",
                                                                    hour: "numeric",
                                                                    minute: "2-digit",
                                                                })}
                                                            </span>

                                                            <span className="flex items-center gap-1">
                                                                ₹{order.final_amount.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-sm font-semibold ${order.status === "completed"
                                                            ? "bg-green-100 text-green-800"
                                                            : order.status === "pending"
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : "bg-gray-100 text-gray-800"
                                                            }`}
                                                    >
                                                        {order.status}
                                                    </span>

                                                    {isOpen ? (
                                                        <ChevronUp className="h-5 w-5 text-gray-600" />
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5 text-gray-600" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* ===== Order Details (Expandable) ===== */}
                                            {isOpen && (
                                                <div className="border-t px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Customer Details */}
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 mb-2">
                                                            Customer Details
                                                        </h4>
                                                        {customer ? (
                                                            <div className="text-sm text-gray-600 space-y-1">
                                                                <p>
                                                                    <span className="font-medium">Name:</span>{" "}
                                                                    {customer.name}
                                                                </p>
                                                                <p>
                                                                    <span className="font-medium">Phone:</span>{" "}
                                                                    {customer.phone}
                                                                </p>
                                                                <p>
                                                                    <span className="font-medium">Address:</span>{" "}
                                                                    {customer.address}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-500">
                                                                Customer information not available
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Order Items */}
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 mb-2">
                                                            Order Items
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {items.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                                                                >
                                                                    <span className="text-gray-700">
                                                                        {item.products?.name || "Product"}
                                                                    </span>
                                                                    <span className="font-semibold">
                                                                        {item.quantity} × ₹{item.price.toFixed(2)} = ₹
                                                                        {item.subtotal.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Total */}
                                                    <div className="space-y-1 text-sm w-fit">
                                                        <div className="flex justify-between">
                                                            <span>Subtotal</span>
                                                            <span>₹{(order.total_amount ?? 0).toFixed(2)}</span>
                                                        </div>

                                                        <div className="flex justify-between">
                                                            <span>Delivery</span>
                                                            <span>₹{(order.delivery_charge ?? 0).toFixed(2)}</span>
                                                        </div>

                                                        <div className="flex justify-between font-semibold text-lg text-blue-600 pt-2 border-t">
                                                            <span>Total</span>
                                                            <span>
                                                                ₹{(order.final_amount ?? order.total_amount ?? 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>


                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}



            </div>
        </div>
    );
}
