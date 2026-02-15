

// ===== IMPORTS =====
import { useEffect, useState, useMemo } from "react";
import {
    Package,
    Users,
    ShoppingCart,
    MapPin,
    Trash2,
    ArrowLeft,
    Minus,
    Plus,
    ChevronUp,
    ChevronDown,
    Calendar,
    Navigation,
    Search,
    LogOut,
    Truck
} from "lucide-react";

import { supabase, Product } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { AppLauncher } from "@capacitor/app-launcher";
import Deliver from "../employee/Deliver";


// ===== TYPES =====
type Customer = {
    id: string;
    name: string;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    image_url: string | null;   // 👈 ADD THIS

};

type CartItem = {
    product: Product;
    qty: number;
    price: number;
};

type OrderWithItems = {
    id: string;
    total_amount: number;
    final_amount: number;
    delivery_charge: number;
    discount_amount: number;
    status: string;
    created_at: string;
    customer_id: string;
    customers?: Customer;
    order_items?: Array<{
        id: string;
        quantity: number;
        price: number;
        subtotal: number;
        products: Product;
    }>;
};

// ===== COMPONENT =====
export default function EmployeeDashboard() {
    const { profile, signOut } = useAuth();

    const [tab, setTab] = useState<"products" | "customers" | "orders" | "cart" | "deliver">("products");
    const [employeeId, setEmployeeId] = useState<string | null>(null);

    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);

    // ----- Customer Form -----
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [locationStatus, setLocationStatus] = useState("");
    const [addingCustomer, setAddingCustomer] = useState(false);
    const [customerTab, setCustomerTab] = useState<"existing" | "new">("existing");
    const [shopImage, setShopImage] = useState<File | null>(null);


    // const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    const [customerSearchQuery, setCustomerSearchQuery] = useState("");
    const [productSearchQuery, setProductSearchQuery] = useState("");

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [discount, setDiscount] = useState(0);
    const [editingTotalId, setEditingTotalId] = useState<string | null>(null);
    // const [deliveryCharge, setDeliveryCharge] = useState(10);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());



    // ===== CATEGORY FILTER =====
    useEffect(() => {
        const cats = Array.from(
            new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
        ).sort();

        setCategories(cats);
    }, [products]);

    useEffect(() => {
        let filtered = products;

        if (selectedCategory) {
            filtered = filtered.filter(
                (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        const raw = productSearchQuery.trim().toLowerCase();

        if (raw) {
            const numericQ = raw.replace(/[^\d]/g, "");
            const targetId = numericQ ? parseInt(numericQ, 10) : NaN;

            filtered = filtered.filter((p) => {
                const matchesName = p.name?.toLowerCase().includes(raw);

                const matchesId =
                    !Number.isNaN(targetId) &&
                    p.item_id !== undefined &&
                    p.item_id === targetId;

                return matchesName || matchesId;
            });
        }

        setFilteredProducts(filtered);
    }, [products, selectedCategory, productSearchQuery]);

    // ===== AUTH =====
    useEffect(() => {
        const getUser = async () => {
            const { data } = await supabase.auth.getUser();
            if (data?.user) setEmployeeId(data.user.id);
        };
        getUser();
    }, []);

    // ===== FETCH DATA =====
    useEffect(() => {
        if (employeeId) {
            fetchProducts();
            fetchCustomers();
            fetchOrders();
            setLoading(false);
        }
    }, [employeeId]);

    const groupedOrders = useMemo(() => {
        const map = new Map<string, typeof orders>();

        orders.forEach((order) => {
            const dateKey = new Date(order.created_at).toDateString();

            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }

            map.get(dateKey)!.push(order);
        });

        return Array.from(map.entries());
    }, [orders]);


    const toggleDay = (day: string) => {
        const newSet = new Set(expandedDays);
        newSet.has(day) ? newSet.delete(day) : newSet.add(day);
        setExpandedDays(newSet);
    };

    const toggleOrder = (id: string) => {
        const newSet = new Set(expandedOrders);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setExpandedOrders(newSet);
    };


    const fetchProducts = async () => {
        const { data } = await supabase.from("products").select("*");
        setProducts(data || []);
    };

    const fetchCustomers = async () => {
        if (!employeeId) return;

        const { data } = await supabase
            .from("customers")
            .select("*")
            .eq("employee_id", employeeId)
            .order("created_at", { ascending: false });

        setCustomers(data || []);
    };

    const fetchOrders = async () => {
        if (!employeeId) return;

        const { data } = await supabase
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

        setOrders((data as OrderWithItems[]) || []);
    };

    // ===== LOCATION =====
    const setCurrentLocation = async () => {
        setLocationStatus("Getting location...");

        try {
            if (Capacitor.isNativePlatform()) {
                await Geolocation.requestPermissions();
                const position = await Geolocation.getCurrentPosition();

                setLat(position.coords.latitude);
                setLng(position.coords.longitude);
            } else {
                navigator.geolocation.getCurrentPosition((pos) => {
                    setLat(pos.coords.latitude);
                    setLng(pos.coords.longitude);
                });
            }

            setLocationStatus("Location captured successfully!");
            setTimeout(() => setLocationStatus(""), 3000);
        } catch (e: any) {
            setLocationStatus(e.message);
        }
    };

    // ===== SET LOCATION FOR EXISTING CUSTOMER =====
    const setCustomerLocation = async (customer: Customer) => {
        try {
            setLocationStatus("Getting location...");

            let newLat: number | null = null;
            let newLng: number | null = null;

            if (Capacitor.isNativePlatform()) {
                await Geolocation.requestPermissions();
                const position = await Geolocation.getCurrentPosition();
                newLat = position.coords.latitude;
                newLng = position.coords.longitude;
            } else {
                await new Promise<void>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            newLat = pos.coords.latitude;
                            newLng = pos.coords.longitude;
                            resolve();
                        },
                        (err) => reject(err)
                    );
                });
            }

            if (!newLat || !newLng) {
                alert("Unable to fetch location");
                return;
            }

            // 🔥 UPDATE CUSTOMER IN DATABASE
            const { error } = await supabase
                .from("customers")
                .update({
                    latitude: newLat,
                    longitude: newLng,
                })
                .eq("id", customer.id);

            if (error) {
                console.error(error);
                alert("Failed to save location");
                return;
            }

            setLocationStatus("Location saved successfully!");

            // Refresh customers list
            await fetchCustomers();

        } catch (err: any) {
            console.error(err);
            alert("Location error");
        }
    };


    // ===== CUSTOMER =====
    const addCustomer = async () => {
        if (!employeeId) return;

        setAddingCustomer(true);

        let imageUrl = null;

        // ✅ Upload image if selected
        if (shopImage) {
            const fileName = `${Date.now()}-${shopImage.name}`;

            const { error: uploadError } = await supabase.storage
                .from("customer-images")   // 👈 your bucket name
                .upload(fileName, shopImage);

            if (!uploadError) {
                const { data } = supabase.storage
                    .from("customer-images")
                    .getPublicUrl(fileName);

                imageUrl = data.publicUrl;
            }
        }

        // ✅ Insert customer with image URL
        const { data } = await supabase
            .from("customers")
            .insert([
                {
                    name,
                    phone,
                    address,
                    latitude: lat,
                    longitude: lng,
                    employee_id: employeeId,
                    image_url: imageUrl   // 👈 new column
                }
            ])
            .select()
            .single();

        if (data) {
            setActiveCustomer(data);
            setCustomerTab("existing");

            setName("");
            setPhone("");
            setAddress("");
            setLat(null);
            setLng(null);
            setShopImage(null); // reset image

            await fetchCustomers();
        }

        setAddingCustomer(false);
    };

    const selectCustomer = (c: Customer) => {
        setActiveCustomer(c);
        setTab("products");
    };

    // ===== CART =====
    const addToCart = (product: Product) => {
        if (!activeCustomer) {
            setTab("customers");
            return;
        }

        setCart((prev) => {
            const exist = prev.find((p) => p.product.id === product.id);

            if (exist) {
                return prev.map((p) =>
                    p.product.id === product.id
                        ? { ...p, qty: p.qty + 1 }
                        : p
                );
            }

            return [...prev, { product, qty: 1, price: product.price }];
        });
    };

    const updateLineTotal = (productId: string, newTotal: number) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.product.id !== productId) return item;

                const newUnitPrice =
                    item.qty > 0 ? newTotal / item.qty : 0;

                return {
                    ...item,
                    price: newUnitPrice,
                };
            })
        );
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

    const totalAmount = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const finalTotal = Math.max(totalAmount - discount, 0);



    // ===== PLACE ORDER =====
    const deliveryCharge = 10;

    const placeOrder = async () => {
        if (!employeeId || !activeCustomer || cart.length === 0) return;

        // Ensure discount is valid number
        const discountAmount = Number(discount) || 0;

        // Calculate subtotal from cart (safe way)
        const subtotal = cart.reduce(
            (sum, item) => sum + item.qty * item.price,
            0
        );

        // Calculate final amount (prevent negative)
        const calculatedFinalAmount = Math.max(
            subtotal + deliveryCharge - discountAmount,
            0
        );

        // Insert Order
        console.log("Inserting order...");

        const response = await supabase
            .from("orders")
            .insert([
                {
                    employee_id: employeeId,
                    customer_id: activeCustomer.id,
                    total_amount: subtotal,
                    delivery_charge: deliveryCharge,
                    discount_amount: discountAmount,
                    final_amount: calculatedFinalAmount,
                    status: "pending"
                }
            ])
            .select()
            .single();

        console.log("Supabase response:", response);

        const { data: order, error } = response;

        if (error) {
            console.error("Order insert error:", error);
            alert(error.message);
            return;
        }

        if (!order) {
            console.error("No order returned");
            return;
        }


        // Insert Order Items
        await supabase.from("order_items").insert(
            cart.map((c) => ({
                order_id: order.id,
                product_id: c.product.id,
                quantity: c.qty,
                price: c.price,
                subtotal: c.qty * c.price
            }))
        );

        // Reset
        setCart([]);
        setDiscount(0); // reset discount
        await fetchOrders();
        setTab("orders");
    };


    // ===== DELETE ORDER =====
    const deleteOrder = async (orderId: string) => {
        await supabase.from("order_items").delete().eq("order_id", orderId);
        await supabase.from("orders").delete().eq("id", orderId);
        await fetchOrders();
    };

    // ===== LOADING =====
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                Loading...
            </div>
        );
    }

    const handleLogout = async () => {
        if (confirm("Logout?")) await signOut();
    };

    // ===== UI =====
    return (
        <div className="min-h-screen bg-gray-50 ">
            {/* Header */}
            <div className="bg-white shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-2 lg:px-8 py-2">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-900 sm:text-sm md:text-2xl">Employee Dashboard</h1>
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
                                <LogOut className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setTab("cart")}
                                className="relative bg-white border border-gray-300 rounded-lg p-2 hover:bg-gray-50 transition"
                            >
                                <ShoppingCart className="h-5 w-5 text-gray-700" />
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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                {/* === STICKY HEADER SECTION (All in One) === */}
                <div className="sticky top-[71px] z-30 bg-white border-b border-gray-200 shadow-sm">

                    {/* Tabs */}
                    <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide px-2 py-2 gap-2">
                        {[
                            { key: "products", label: "Products", icon: Package },
                            { key: "customers", label: "Customer", icon: ShoppingCart },
                            { key: "orders", label: "Orders", icon: Users },
                            { key: "deliver", label: "Deliver", icon: Truck },
                        ].map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${tab === key
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Active Customer Banner */}
                    {activeCustomer && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-600">Active Customer</p>
                                    <p className="font-semibold text-sm text-gray-900">{activeCustomer.name}</p>
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

                    {/* Products Controls */}
                    {tab === "products" && (
                        <div className="px-2 pb-2 space-y-2">

                            {/* Small Warning */}
                            {!activeCustomer && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1.5">
                                    <p className="text-xs text-yellow-800">
                                        ⚠ Select a customer
                                    </p>
                                </div>
                            )}

                            {/* Small Search */}
                            {products.length > 0 && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by Item ID..."
                                        value={productSearchQuery}
                                        onChange={(e) => setProductSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Small Categories */}
                            {categories.length > 0 && (
                                <div className="overflow-x-auto scrollbar-hide">
                                    <div className="flex gap-2 whitespace-nowrap">
                                        <button
                                            onClick={() => setSelectedCategory(null)}
                                            className={`px-3 py-1 text-xs rounded-full font-medium
                            ${selectedCategory === null
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-100 text-gray-700"
                                                }`}
                                        >
                                            All
                                        </button>

                                        {categories.map((category) => (
                                            <button
                                                key={category}
                                                onClick={() => setSelectedCategory(category)}
                                                className={`px-3 py-1 text-xs rounded-full font-medium
                                ${selectedCategory === category
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-gray-100 text-gray-700"
                                                    }`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                {/* Products Tab */}
                {tab === "products" && (
                    <div>
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
                                                        <div className="flex justify-between">
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
                                                            <div className="w-[100px] h-[100px] rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
                                                                <img
                                                                    src="https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d"
                                                                    alt={customer.name}
                                                                    className="w-full h-full object-cover"
                                                                />
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
                                                            {/* If location exists → Show Locate */}
                                                            {customer.latitude != null && customer.longitude != null ? (

                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();

                                                                        try {
                                                                            const lat = customer.latitude;
                                                                            const lng = customer.longitude;

                                                                            if (!lat || !lng) {
                                                                                alert("Location not saved for this customer");
                                                                                return;
                                                                            }

                                                                            if (Capacitor.isNativePlatform()) {
                                                                                const url = `geo:${lat},${lng}?q=${lat},${lng}`;
                                                                                await AppLauncher.openUrl({ url });
                                                                            } else {
                                                                                const url = `https://www.google.com/maps?q=${lat},${lng}`;
                                                                                window.open(url, "_blank", "noopener,noreferrer");
                                                                            }
                                                                        } catch (error) {
                                                                            console.error("Map open error:", error);
                                                                        }
                                                                    }}
                                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                                                                >
                                                                    <Navigation className="h-4 w-4" />
                                                                    Locate
                                                                </button>

                                                            ) : (

                                                                /* If NO location → Show Set Location */
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCustomerLocation(customer);
                                                                    }}
                                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition text-sm font-medium"
                                                                >
                                                                    <MapPin className="h-4 w-4" />
                                                                    Set Location
                                                                </button>

                                                            )}
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Shop Image
                                        </label>

                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) =>
                                                setShopImage(e.target.files ? e.target.files[0] : null)
                                            }
                                            className="w-full px-4 py-2 border rounded-lg bg-white"
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

                {tab === "deliver" && (
                    <Deliver
                        orders={orders}
                        fetchOrders={fetchOrders}
                    />
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
                                                    ₹{item.product.price}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => updateQty(item.product.id, item.qty - 1)}
                                                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="font-semibold w-8 text-center">{item.qty}</span>
                                                    <button
                                                        onClick={() => updateQty(item.product.id, item.qty + 1)}
                                                        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                    {editingTotalId === item.product.id ? (
                                                        <input
                                                            type="number"
                                                            autoFocus
                                                            value={(item.price * item.qty)}
                                                            onChange={(e) =>
                                                                updateLineTotal(item.product.id, Number(e.target.value))
                                                            }
                                                            onBlur={() => setEditingTotalId(null)}
                                                            className="ml-4 border rounded px-2 py-1 w-28"

                                                        />
                                                    ) : (
                                                        <span
                                                            onClick={() => setEditingTotalId(item.product.id)}
                                                            className="ml-4 font-semibold text-gray-900 cursor-pointer"
                                                        >
                                                            ₹{(item.price * item.qty)}
                                                        </span>
                                                    )}
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
                                                <span className="font-semibold">₹{totalAmount}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Items</span>
                                                <span className="font-semibold">{cart.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600">Discount</span>
                                                <input
                                                    type="number"
                                                    value={discount}
                                                    onChange={(e) => setDiscount(Number(e.target.value))}
                                                    className="w-24 border rounded px-2 py-1 text-right"
                                                    min="0"
                                                    max={totalAmount}
                                                />
                                            </div>

                                            <div className="border-t pt-3 flex justify-between">
                                                <span className="text-lg font-semibold text-gray-900">Total</span>
                                                <span className="text-2xl font-bold text-blue-600">
                                                    ₹{finalTotal}
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
                            <div className="space-y-6">
                                {groupedOrders.map(([day, dayOrders]) => {
                                    const isDayOpen = expandedDays.has(day);

                                    return (
                                        <div key={day} className="bg-white rounded-xl shadow-md overflow-hidden">

                                            {/* ===== Day Header ===== */}
                                            <div
                                                onClick={() => toggleDay(day)}
                                                className="cursor-pointer px-6 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Calendar className="h-5 w-5 text-blue-600" />
                                                    <h3 className="font-semibold text-lg">
                                                        {new Date(day).toLocaleDateString("en-US", {
                                                            weekday: "long",
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </h3>
                                                </div>

                                                {isDayOpen ? (
                                                    <ChevronUp className="h-5 w-5 text-gray-600" />
                                                ) : (
                                                    <ChevronDown className="h-5 w-5 text-gray-600" />
                                                )}
                                            </div>

                                            {/* ===== Orders Under This Day ===== */}
                                            {isDayOpen && (
                                                <div className="divide-y">
                                                    {dayOrders.map((order) => {
                                                        const isOpen = expandedOrders.has(order.id);
                                                        const customer = order.customers;
                                                        const items = order.order_items || [];

                                                        return (
                                                            <div key={order.id}>

                                                                {/* Order Header */}
                                                                <div
                                                                    onClick={() => toggleOrder(order.id)}
                                                                    className="cursor-pointer px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
                                                                >
                                                                    <div>
                                                                        <p className="font-semibold">
                                                                            {customer?.name || order.id.slice(0, 8)}
                                                                        </p>
                                                                        <p className="text-sm text-gray-500">
                                                                            {new Date(order.created_at).toLocaleTimeString([], {
                                                                                hour: "2-digit",
                                                                                minute: "2-digit",
                                                                            })}
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex items-center gap-4">
                                                                        <span className="font-semibold text-blue-600">
                                                                            ₹{order.final_amount}
                                                                        </span>

                                                                        {isOpen ? (
                                                                            <ChevronUp className="h-5 w-5 text-gray-600" />
                                                                        ) : (
                                                                            <ChevronDown className="h-5 w-5 text-gray-600" />
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Order Details */}
                                                                {isOpen && (
                                                                    <div className="px-6 pb-4 grid md:grid-cols-2 gap-6">
                                                                        <div>
                                                                            <h4 className="font-semibold mb-2">Customer</h4>
                                                                            <p>{customer?.name}</p>
                                                                            <p className="text-sm text-gray-600">
                                                                                {customer?.phone}
                                                                            </p>
                                                                            <p className="text-sm text-gray-600">
                                                                                {customer?.address}
                                                                            </p>
                                                                        </div>

                                                                        <div>
                                                                            <h4 className="font-semibold mb-2">Items</h4>
                                                                            {items.map((item) => (
                                                                                <div
                                                                                    key={item.id}
                                                                                    className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 mb-2"
                                                                                >
                                                                                    {/* Left Side: Image + Name */}
                                                                                    <div className="flex items-center gap-3">
                                                                                        <img
                                                                                            src={item.products?.image_url || "/placeholder.png"}
                                                                                            alt={item.products?.name}
                                                                                            className="w-12 h-12 object-cover rounded-md border"
                                                                                        />

                                                                                        <div>
                                                                                            <p className="text-sm font-medium">
                                                                                                {item.products?.name}
                                                                                            </p>
                                                                                            <p className="text-xs text-gray-500">
                                                                                                ₹{item.price} each
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Right Side: Quantity */}
                                                                                    <div className="text-sm font-semibold">
                                                                                        {item.quantity} × ₹{item.price}
                                                                                    </div>
                                                                                </div>
                                                                            ))}

                                                                        </div>

                                                                        <div className="md:col-span-2 text-right font-bold text-lg text-blue-600">
                                                                            Total: ₹{order.final_amount}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
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