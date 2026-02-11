import { useState, useEffect } from 'react';
import { Package, ShoppingCart, LogOut, Edit, Trash2, Plus, X, Users, CreditCard, BarChart3, TrendingUp, Upload, Printer, ReceiptText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../context/AuthContext';
import { supabase, Product, Order, OrderItem, Profile } from '../../lib/supabase';
import BulkProductUpload from './BulkProductUpload';
import { Capacitor } from '@capacitor/core';




type Page =
  | 'home'
  | 'profile'
  | 'cart'
  | 'checkout'
  | 'bills'
  | 'admin'
  | 'createOrder'
  | 'adminOrder';

interface AdminDashboardProps {
  onNavigate: (page: Page, id?: string) => void;
}

interface OrderWithItems extends Order {
  order_items: (OrderItem & { products: Product })[];
  profiles: { name: string; email: string; phone: string; address: string };
  customers?: { id: string; name: string; phone: string; address: string };
}

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockProducts: number;
  totalUsers: number;
  pendingOrders: number;
}

interface DailySales {
  date: string;
  sales: number;
}

type AdminTab = 'overview' | 'products' | 'orders' | 'bills' | 'users' | 'customers' | 'payments' | 'analytics';

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Array<{
    id: string;
    name: string;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    employee_id: string;
    created_at: string;
    profiles?: { name: string; email: string };
  }>>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    totalUsers: 0,
    pendingOrders: 0,
  });
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    mrp: '',
    image_url: '',
    stock: '',
    category: '',
    item_id: '',
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderWithItems | null>(null);
  const [editingOrderItems, setEditingOrderItems] = useState<(OrderItem & { products: Product })[]>([]);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);




  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch customers when switching to Customers tab so new customers added by employees appear
  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomers();
    }
  }, [activeTab]);

  // to filter the product by category



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

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))
  ).sort();


  // upload image in add the product form

  const uploadImage = async (file: File) => {
    console.log('Uploading to bucket: product-images');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (error) {
      console.error(error);
      return null;
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl; // ✅ REQUIRED
  };


  const openProductModal = (product?: Product) => {
    setSelectedImage(null);
    setImagePreview(product?.image_url || '');

    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        price: product.price.toString(),
        mrp: product.mrp?.toString() || '',
        image_url: product.image_url,
        stock: product.stock.toString(),
        category: product.category || '',
        item_id: product.item_id?.toString() || '',
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        price: '',
        mrp: '',
        image_url: '',
        stock: '',
        category: '',
        item_id: '',
      });
    }

    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    console.log('HANDLE SAVE PRODUCT CALLED');

    try {
      let imageUrl = productForm.image_url; // for edit without changing image
      let itemIdToUse: number | undefined;

      // 👇 UPLOAD IMAGE IF SELECTED
      if (selectedImage) {
        const uploadedUrl = await uploadImage(selectedImage);
        if (!uploadedUrl) return;

        imageUrl = uploadedUrl;
      }

      // Decide item_id:
      // - If user typed one, use it
      // - If creating and left empty, auto-assign max(item_id) + 1
      if (productForm.item_id && productForm.item_id.trim() !== '') {
        itemIdToUse = Number(productForm.item_id);
      } else if (!editingProduct) {
        const { data: maxRows, error: maxError } = await supabase
          .from('products')
          .select('item_id')
          .order('item_id', { ascending: false })
          .limit(1);

        if (maxError) {
          console.error('Error fetching max item_id:', maxError);
        }

        const currentMax = (maxRows && maxRows[0]?.item_id) || 0;
        itemIdToUse = Number(currentMax) + 1;
      }

      const payload: {
        name: string;
        price: number;
        mrp: number | null;
        stock: number;
        category: string;
        image_url: string;
        item_id?: number;
      } = {
        name: productForm.name,
        price: Number(productForm.price),
        mrp: productForm.mrp ? Number(productForm.mrp) : null,
        stock: Number(productForm.stock),
        category: productForm.category,
        image_url: imageUrl, // ✅ THIS WAS MISSING
      };

      if (itemIdToUse !== undefined && !Number.isNaN(itemIdToUse)) {
        payload.item_id = itemIdToUse;
      }

      if (editingProduct) {
        await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
      } else {
        await supabase
          .from('products')
          .insert([payload]);
      }

      setShowProductModal(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    }
  };




  const fetchAllData = async () => {
    await Promise.all([
      fetchProducts(),
      fetchOrders(),
      fetchUsers(),
      fetchCustomers(),
      calculateStats(),
      calculateDailySales(),
    ]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  
  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          profiles (
            name,
            email,
            phone,
            address
          ),
          customers (
            id,
            name,
            phone,
            address
          ),
          order_items (
            id,
            quantity,
            price,
            subtotal,
            products (
              id,
              name,
              price,
              image_url
            )
          )
        `)
        .order('created_at', { ascending: false })
        .throwOnError();

      const processedOrders = (data || []).map((order: Order & {
        profiles: { name: string; email: string; phone: string; address: string } | { name: string; email: string; phone: string; address: string }[];
        order_items: (OrderItem & { products: Product })[]
      }) => ({
        ...order,
        profiles: Array.isArray(order.profiles)
          ? order.profiles[0]
          : order.profiles,
        order_items: order.order_items ?? [],
      }));

      setOrders(processedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    }
  };


  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as Profile[]) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      // Fetch customers without join so RLS only applies to customers table (admin can see all)
      const { data: customerRows, error: customerError } = await supabase
        .from('customers')
        .select('id, name, phone, address, latitude, longitude, employee_id, created_at')
        .order('created_at', { ascending: false });

      if (customerError) {
        console.error('Error fetching customers:', customerError);
        setCustomers([]);
        return;
      }

      if (!customerRows || customerRows.length === 0) {
        setCustomers([]);
        return;
      }

      type CustomerRow = { id: string; name: string; phone: string; address: string; latitude: number | null; longitude: number | null; employee_id: string; created_at: string };
      const rows = customerRows as CustomerRow[];

      // Get unique employee IDs and fetch their profile names
      const employeeIds = [...new Set(rows.map((c) => c.employee_id).filter(Boolean))];
      let profileMap: Record<string, { name: string; email: string }> = {};
      if (employeeIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', employeeIds);
        if (profilesData) {
          profileMap = profilesData.reduce((acc, p) => {
            acc[p.id] = { name: p.name ?? '', email: p.email ?? '' };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }

      const merged = rows.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
        employee_id: c.employee_id,
        created_at: c.created_at,
        profiles: profileMap[c.employee_id],
      }));
      setCustomers(merged);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customerId);
      if (error) throw error;
      await fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer.');
    }
  };



  const calculateStats = async () => {
    try {
      const [productsRes, ordersRes, usersRes] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact' }),
        supabase.from('orders').select('*', { count: 'exact' }),
        supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'user'),
      ]);

      const lowStockRes = await supabase
        .from('products')
        .select('*')
        .lt('stock', 10);

      const pendingOrdersRes = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('status', 'pending');

      let totalRevenue = 0;
      if (ordersRes.data) {
        totalRevenue = ordersRes.data.reduce(
          (sum, order) => sum + (order.final_amount || 0),
          0
        );
      }

      setStats({
        totalProducts: productsRes.count || 0,
        totalOrders: ordersRes.count || 0,
        totalRevenue,
        lowStockProducts: lowStockRes.data?.length || 0,
        totalUsers: usersRes.count || 0,
        pendingOrders: pendingOrdersRes.count || 0,
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const calculateDailySales = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('final_amount, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const dailyData: Record<string, number> = {};
      if (data) {
        data.forEach((order) => {
          const date = new Date(order.created_at);
          const dateKey = date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          dailyData[dateKey] = (dailyData[dateKey] || 0) + (order.final_amount ?? 0);
        });
      }

      const dailyArray = Object.entries(dailyData).map(([date, sales]) => ({
        date,
        sales: Math.round(sales * 100) / 100,
      }));

      setDailySales(dailyArray.slice(-30));
    } catch (error) {
      console.error('Error calculating daily sales:', error);
    }
  };


  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
  };

  
  const deleteProduct = async (id: string) => {
    // if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const deleteUser = async (id: string) => {
    const isConfirmed = window.confirm(
      'Are you sure you want to delete this user? This action cannot be undone.'
    );
    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting user:', error);
        alert(`Failed to delete user: ${error.message}`);
        return;
      }

      await fetchUsers();
      // alert('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to delete user: ${errorMessage}`);
    }
  };


  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

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

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await signOut();
    }
  };

  // Group orders by day
  const groupOrdersByDay = () => {
    const grouped: Record<string, OrderWithItems[]> = {};
    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const dayKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(order);
    });
    return grouped;
  };

  const getOrderDays = () => {
    const grouped = groupOrdersByDay();
    // Sort days by getting the first order's date from each day
    return Object.keys(grouped).sort((a, b) => {
      const dateA = grouped[a][0]?.created_at ? new Date(grouped[a][0].created_at).getTime() : 0;
      const dateB = grouped[b][0]?.created_at ? new Date(grouped[b][0].created_at).getTime() : 0;
      return dateB - dateA; // Most recent first
    });
  };

  const getOrdersForDay = (day: string) => {
    const grouped = groupOrdersByDay();
    return grouped[day] || [];
  };

  // Edit order functions
  const openEditOrderModal = (order: OrderWithItems) => {
    setEditingOrder(order);
    setEditingOrderItems([...order.order_items]);
    setShowEditOrderModal(true);
  };

  const closeEditOrderModal = () => {
    setShowEditOrderModal(false);
    setEditingOrder(null);
    setEditingOrderItems([]);
  };

  const removeOrderItem = (itemId: string) => {
    if (editingOrderItems.length <= 1) {
      alert('An order must have at least one item. You cannot remove the last item.');
      return;
    }
    setEditingOrderItems((items) => items.filter((item) => item.id !== itemId));
  };

  const updateOrderItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setEditingOrderItems((items) =>
      items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            quantity: newQuantity,
            subtotal: item.price * newQuantity,
          }
          : item
      )
    );
  };

  const recalculateOrderTotals = () => {
    if (!editingOrder) {
      return { subtotal: 0, deliveryCharge: 0, discount: 0, finalAmount: 0 };
    }
    const subtotal = editingOrderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const deliveryCharge = editingOrder.delivery_charge || 0;
    const discount = editingOrder.discount || 0;
    const finalAmount = subtotal + deliveryCharge - discount;
    return { subtotal, deliveryCharge, discount, finalAmount };
  };

  const saveOrderChanges = async () => {
    if (!editingOrder) return;

    const { subtotal, finalAmount } = recalculateOrderTotals();

    try {

      const updates = editingOrderItems.map((item) => ({
        id: item.id,
        order_id: editingOrder.id,
        product_id: item.product_id ?? item.products?.id,
        quantity: item.quantity,
        price: item.price ?? item.products?.price,
        subtotal: item.subtotal,
      }));


      // ✅ Delete removed items
      const originalItemIds = editingOrder.order_items.map(item => item.id);
      const currentItemIds = editingOrderItems.map(item => item.id);
      const itemsToDelete = originalItemIds.filter(
        id => !currentItemIds.includes(id)
      );

      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', itemsToDelete);

        if (deleteError) throw deleteError;
      }

      // ✅ Update / Insert order items safely
      const { error: updateItemsError } = await supabase
        .from('order_items')
        .upsert(updates);

      if (updateItemsError) throw updateItemsError;

      // ✅ Update order totals
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: subtotal,
          final_amount: finalAmount,
        })
        .eq('id', editingOrder.id);

      if (orderError) throw orderError;

      alert('Order updated successfully!');

      closeEditOrderModal();

      // 🔁 Force fresh reload
      setLoading(true);
      await Promise.all([
        fetchOrders(),
        calculateStats(),
        calculateDailySales(),
      ]);
      setLoading(false);

    } catch (error: unknown) {
      console.error('FULL ERROR:', error);
      alert(error instanceof Error ? error.message : 'Failed to update order');
    }
  };

  const generateBillNumber = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const t = String(now.getTime()).slice(-6);
    return `INV-${y}${m}${d}-${t}`;
  };

  /** Build and save bill as thermal-size PDF (80mm width) for printing/saving to device */
  const saveBillAsThermalPdf = async (order: OrderWithItems, billNo: string) => {
    const safe = (v: unknown) => String(v ?? '').trim();

    const money = (value: unknown, opts?: { negative?: boolean }) => {
      const n = Number(value ?? 0);
      const abs = Math.abs(Number.isFinite(n) ? n : 0);
      const prefix = opts?.negative ? '-' : '';
      return `${prefix}Rs. ${abs.toFixed(2)}`;
    };

    const customerFromTable = (order as OrderWithItems).customers;
    const customerName =
      customerFromTable?.name ||
      (order as Order & { customer_name?: string }).customer_name ||
      order.profiles?.name ||
      '';
    const customerPhone =
      customerFromTable?.phone ||
      (order as Order & { customer_phone?: string }).customer_phone ||
      order.profiles?.phone ||
      '';
    const customerAddress =
      customerFromTable?.address ||
      (order as Order & { customer_address?: string }).customer_address ||
      order.profiles?.address ||
      '';

    const margin = THERMAL_MARGIN_MM;
    const width = THERMAL_PDF_WIDTH_MM;
    const contentWidth = width - margin * 2;

    const lineHeight = 4;
    const fontSmall = 7;
    const fontNormal = 8;
    const fontTitle = 10;

    // --------------------------------------------
    // STEP 1: Create temporary doc to calculate height
    // --------------------------------------------
    const tempDoc = new jsPDF({ unit: 'mm' });

    let y = margin;

    const addLine = (lines = 1) => {
      y += lineHeight * lines;
    };

    addLine(2); // Title
    addLine(3); // Bill, Order, Date
    addLine(1); // Customer label
    addLine(3); // Name, Phone

    const addrLines = tempDoc.splitTextToSize(safe(customerAddress) || '-', contentWidth);
    addLine(addrLines.length);

    addLine(2); // Items title + spacing
    addLine(2); // Header + line

    for (const it of order.order_items || []) {
      const name = safe(it.products?.name || 'Unknown');
      const nameLines = tempDoc.splitTextToSize(name, contentWidth * 0.4);
      addLine(nameLines.length);
    }

    addLine(6); // totals section
    addLine(2); // thank you

    const finalHeight = y + margin;

    // --------------------------------------------
    // STEP 2: Create final doc with dynamic height
    // --------------------------------------------
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [width, finalHeight],
    });

    y = margin;
    const w = contentWidth;

    doc.setFontSize(fontTitle);
    doc.text('THERMAL BILL', margin, y);
    y += lineHeight + 2;

    doc.setFontSize(fontSmall);
    doc.text(`Bill: ${billNo}`, margin, y);
    y += lineHeight;
    doc.text(`Order: ${order.id.slice(0, 8)}...`, margin, y);
    y += lineHeight;
    doc.text(`Date: ${new Date().toLocaleString()}`, margin, y);
    y += lineHeight + 2;

    doc.setFontSize(fontNormal);
    doc.text('Customer', margin, y);
    y += lineHeight;

    doc.setFontSize(fontSmall);
    doc.text(safe(customerName), margin, y);
    y += lineHeight;
    doc.text(safe(customerPhone), margin, y);
    y += lineHeight;

    const addrLinesFinal = doc.splitTextToSize(safe(customerAddress) || '-', w);
    for (const line of addrLinesFinal) {
      doc.text(String(line), margin, y);
      y += lineHeight;
    }

    y += 2;

    doc.setFontSize(fontNormal);
    doc.text('Items', margin, y);
    y += lineHeight;

    const colW = [w * 0.4, w * 0.15, w * 0.2, w * 0.25];

    doc.setFontSize(fontSmall);
    doc.text('Item', margin, y);
    doc.text('Qty', margin + colW[0], y);
    doc.text('Price', margin + colW[0] + colW[1], y);
    doc.text('Subtotal', margin + w, y, { align: 'right' });

    y += lineHeight;
    doc.line(margin, y, margin + w, y);
    y += lineHeight;

    for (const it of order.order_items || []) {
      const name = safe(it.products?.name || 'Unknown');
      const nameLines = doc.splitTextToSize(name, colW[0]);

      const qty = safe(it.quantity);
      const price = money(it.price ?? it.products?.price ?? 0);
      const subtotal = money(it.subtotal ?? 0);

      doc.text(nameLines[0], margin, y);
      doc.text(qty, margin + colW[0] + colW[1] - 1, y, { align: 'right' });
      doc.text(price, margin + colW[0] + colW[1] + colW[2] - 1, y, { align: 'right' });
      doc.text(subtotal, margin + w, y, { align: 'right' });

      y += lineHeight;

      for (let i = 1; i < nameLines.length; i++) {
        doc.text(nameLines[i], margin, y);
        y += lineHeight;
      }
    }

    y += 2;

    const totalAmount = Number(order.total_amount || 0);
    const delivery = Number((order as any).delivery_charge ?? 0);
    const discount = Number(order.discount || 0);
    const final = Number(order.final_amount || 0);

    doc.text('Subtotal:', margin, y);
    doc.text(money(totalAmount), margin + w, y, { align: 'right' });
    y += lineHeight;

    doc.text('Delivery:', margin, y);
    doc.text(money(delivery), margin + w, y, { align: 'right' });
    y += lineHeight;

    doc.text('Discount:', margin, y);
    doc.text(money(discount, { negative: discount > 0 }), margin + w, y, { align: 'right' });
    y += lineHeight + 1;

    doc.line(margin, y, margin + w, y);
    y += lineHeight;

    doc.setFontSize(fontTitle);
    doc.text('Total:', margin, y);
    doc.text(money(final), margin + w, y, { align: 'right' });
    y += lineHeight + 4;

    doc.setFontSize(fontSmall);
    doc.text('Thank you!', margin, y);

    const filename = `Bill_${billNo.replace(/\s/g, '_')}.pdf`;
    
    if (Capacitor.getPlatform() === 'web') {
      doc.save(filename);
    } else {
      // Convert PDF to blob
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
    
      // Open in Chrome (external browser)
      await Browser.open({
        url: url,
      });
    }
    
  };


  // const savePdfToMobile = async (base64Data: string, filename: string) => {
  //   try {
  //     const result = await Filesystem.writeFile({
  //       path: filename,
  //       data: base64Data,
  //       directory: Directory.Data,
  //     });
  
  //     await Share.share({
  //       title: 'Bill PDF',
  //       url: result.uri,
  //     });
  
  //   } catch (error: any) {
  //     console.error(error);
  //     alert('Error: ' + (error?.message || JSON.stringify(error)));
  //   }
  // };
  

  const printBillForOrder = async (order: OrderWithItems) => {
    if (!order?.id) return;
    if (!order.order_items || order.order_items.length === 0) {
      alert('Cannot print bill: order has no items');
      return;
    }

    setPrintingOrderId(order.id);

    try {
      // Update stock
      for (const item of order.order_items) {
        const productId = item.product_id ?? item.products?.id;
        if (!productId) continue;

        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', productId)
          .maybeSingle();

        const currentStock = product?.stock ?? 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId);
      }

      // ✅ billNo is defined HERE
      const billNo = generateBillNumber();

      // ✅ MUST be awaited
      await saveBillAsThermalPdf(order, billNo);

    } catch (error) {
      console.error('Error printing bill:', error);
      alert('Failed to print bill');
    } finally {
      setPrintingOrderId(null);
    }
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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {profile?.name}</p>
            </div>
            <div className='flex space-x-2 md:text-sm text-xs'>
              <button
                onClick={() => onNavigate('createOrder')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Create Order
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'products'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Package className="h-4 w-4" />
            <span>Products</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'orders'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Orders</span>
          </button>
          <button
            onClick={() => setActiveTab('bills')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'bills'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <ReceiptText className="h-4 w-4" />
            <span>Saved Bills</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'users'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Users className="h-4 w-4" />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'customers'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Users className="h-4 w-4" />
            <span>Customers</span>
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'payments'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Payments</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition text-sm ${activeTab === 'analytics'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Products</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalProducts}
                    </p>
                  </div>
                  <Package className="h-10 w-10 text-blue-600 opacity-20" />
                </div>
              </div>



              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Orders</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalOrders}
                    </p>
                  </div>
                  <ShoppingCart className="h-10 w-10 text-green-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ₹{stats.totalRevenue}
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-purple-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Low Stock Products</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.lowStockProducts}
                    </p>
                  </div>
                  <Package className="h-10 w-10 text-red-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalUsers}
                    </p>
                  </div>
                  <Users className="h-10 w-10 text-orange-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Orders</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.pendingOrders}
                    </p>
                  </div>
                  <ShoppingCart className="h-10 w-10 text-yellow-600 opacity-20" />
                </div>
              </div>
            </div>

            {stats.lowStockProducts > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-yellow-900 mb-4">
                  Low Stock Alert
                </h3>
                <p className="text-yellow-800">
                  You have {stats.lowStockProducts} product(s) with low stock levels (less than 10 units). Please consider restocking them.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bills' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Saved Bills</h2>
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-xl shadow-sm">
                  <p className="text-gray-600">No bills generated yet.</p>
                </div>
              ) : (
                orders.map((order) => {
                  const orderProfile = order.profiles || {
                    name: 'N/A',
                    phone: 'N/A',
                    address: 'N/A',
                  };
                  // Check for customer from customers table (employee orders) first, then fallback to customer_name fields, then profile
                  const customerFromTable = (order as OrderWithItems).customers;
                  const customerName =
                    customerFromTable?.name ||
                    (order as Order & { customer_name?: string }).customer_name ||
                    orderProfile.name;
                  const customerPhone =
                    customerFromTable?.phone ||
                    (order as Order & { customer_phone?: string }).customer_phone ||
                    orderProfile.phone;
                  const customerAddress =
                    customerFromTable?.address ||
                    (order as Order & { customer_address?: string }).customer_address ||
                    orderProfile.address;
                  const orderItems = order.order_items || [];
                  const itemSummary = orderItems
                    .map((item) => `${item.products?.name ?? 'Item'} × ${item.quantity}`)
                    .slice(0, 3)
                    .join(', ');

                  return (
                    <div key={order.id} className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-500">
                            Order {order.id.slice(0, 8)}… · {new Date(order.created_at).toLocaleString()}
                          </p>
                          <p className="font-semibold text-gray-900">{customerName}</p>
                          <p className="text-sm text-gray-600">{customerPhone}</p>
                          <p className="text-sm text-gray-600">{customerAddress || 'Address not provided'}</p>
                          {itemSummary && (
                            <p className="text-xs text-gray-500 mt-2">Items: {itemSummary}{orderItems.length > 3 ? '…' : ''}</p>
                          )}
                        </div>
                        <div className="text-right space-y-2">
                          <p className="text-lg font-bold text-blue-600">
                            ₹{(order.final_amount || 0).toFixed(2)}
                          </p>
                          <button
                            onClick={() => printBillForOrder(order)}
                            disabled={printingOrderId === order.id}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Printer className="h-4 w-4" />
                            <span>{printingOrderId === order.id ? 'Saving...' : 'Save PDF'}</span>
                          </button>
                          
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Products</h2>
              <div className="flex gap-3 sm:flex-row">
                {/* Bulk Products */}
                <button
                  onClick={() => setShowBulkUploadModal(true)}
                  title="Bulk Products"
                  className="flex items-center justify-center gap-2 bg-green-600 text-white px-2 py-2 sm:px-5 sm:py-3 rounded-full sm:rounded-lg hover:bg-green-700 transition"
                >
                  <Upload className="h-5 w-5" />
                  <span className="hidden sm:inline">Bulk Products</span>
                </button>

                {/* Add Product */}
                <button
                  onClick={() => openProductModal()}
                  title="Add Product"
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-2 py-2 sm:px-5 sm:py-3 rounded-full sm:rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Product</span>
                </button>
              </div>
            </div>

            <div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden"
                >
                  {/* Image Div */}
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      width="300"
                      height="300"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-4">
                    {/* Product Name */}
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {product.name}
                    </h3>

                    {/* Price and MRP Row */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-lg font-bold text-blue-600">
                        ₹{product.price.toFixed(2)}
                      </p>
                      {product.mrp && (
                        <p className="text-lg font-bold text-blue-600">
                          Mrp: ₹{product.mrp.toFixed(2)}
                        </p>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                      Stock: {product.stock}
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openProductModal(product)}
                        className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="flex-1 flex items-center justify-center space-x-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Orders</h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedDay === null ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Day</h3>
                <div className="space-y-2">
                  {getOrderDays().map((day) => {
                    const dayOrders = getOrdersForDay(day);
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className="w-full bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition text-left"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-900">{day}</p>
                            <p className="text-sm text-gray-600">
                              {dayOrders.length} order{dayOrders.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">
                              ₹{dayOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {getOrderDays().length === 0 && (
                    <div className="bg-white p-12 text-center rounded-xl">
                      <p className="text-gray-600">No orders yet</p>
                    </div>
                  )}
                </div>
                {selectedDay && (
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ← Back to Days
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-md font-semibold text-gray-900">
                    Orders for {selectedDay}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ← Back to Days
                  </button>
                </div>
                <div className="space-y-4">
                  {getOrdersForDay(selectedDay).map((order) => {
                    const orderProfile = order.profiles || {
                      name: 'N/A',
                      phone: 'N/A',
                      address: 'N/A',
                    };

                    // Check for customer from customers table (employee orders) first, then fallback to customer_name fields, then profile
                    const customerFromTable = (order as OrderWithItems).customers;
                    const customerName =
                      customerFromTable?.name ||
                      (order as Order & { customer_name?: string }).customer_name ||
                      orderProfile.name;
                    const customerPhone =
                      customerFromTable?.phone ||
                      (order as Order & { customer_phone?: string }).customer_phone ||
                      orderProfile.phone;
                    const customerAddress =
                      customerFromTable?.address ||
                      (order as Order & { customer_address?: string }).customer_address ||
                      orderProfile.address;
                    const customerEmail = orderProfile.email;

                    const orderItems = order.order_items || [];

                    return (
                      <div key={order.id} className="bg-white rounded-xl shadow-md p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm text-gray-600">
                              Order ID: {order.id.slice(0, 8)}...
                            </p>
                            <p className="text-sm text-gray-600">
                              Time: {new Date(order.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap items-center justify-end">
                            {/* Print */}
                            <button
                              onClick={() => printBillForOrder(order)}
                              disabled={printingOrderId === order.id}
                              title="Print Bill"
                              className="flex items-center justify-center gap-2 bg-green-600 text-white px-2 py-2 sm:px-4 sm:py-2 rounded-full sm:rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Printer className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {printingOrderId === order.id ? 'Printing...' : 'Print Bill'}
                              </span>
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => openEditOrderModal(order)}
                              title="Edit Order"
                              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-2 py-2 sm:px-4 sm:py-2 rounded-full sm:rounded-lg hover:bg-blue-700 transition"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="hidden sm:inline">Edit Order</span>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => deleteOrder(order.id)}
                              title="Delete Order"
                              className="flex items-center justify-center gap-2 bg-red-600 text-white px-2 py-2 sm:px-4 sm:py-2 rounded-full sm:rounded-lg hover:bg-red-700 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>

                            {/* Status Dropdown */}
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:w-auto"
                            >
                              <option value="pending">Pending</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>

                        </div>

                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Customer Details</h4>
                          <p>{customerName}</p>
                          <p>{customerEmail}</p>
                          <p>{customerPhone}</p>
                          <p>{customerAddress}</p>
                        </div>

                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Order Items</h4>

                          {orderItems.length > 0 ? (
                            orderItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between text-sm"
                              >
                                <span>
                                  {item.products?.name || 'Unknown Product'} × {item.quantity}
                                </span>
                                <span>
                                  ₹{(item.subtotal || 0).toFixed(2)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">
                              No items in this order
                            </p>
                          )}
                        </div>

                        <div className="border-t pt-4">
                          <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>₹{(order.total_amount || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Delivery</span>
                            <span>₹{(order.delivery_charge || 20).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Discount</span>
                            <span className="text-green-600">
                              -₹{(order.discount || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span className="text-blue-600">
                              ₹{(order.final_amount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}


        {activeTab === 'users' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.phone || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                              }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          ><Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-gray-600">No users found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Management</h2>
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Customer Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-600">
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      customers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {customer.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {customer.phone}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                            {customer.address}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {customer.profiles?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {customer.latitude && customer.longitude ? (
                              <span className="text-green-600">✓ Saved</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(customer.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-right">
                            <button
                              onClick={() => deleteCustomer(customer.id)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                              title="Delete customer"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Payment Transactions</h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  // 🔹 profile fallback (user orders)
                  const orderProfile = order.profiles || {
                    name: 'N/A',
                    phone: 'N/A',
                    address: 'N/A',
                  };

                  // 🔹 customers table (employee/admin orders)
                  const customerFromTable = (order as OrderWithItems).customers;

                  // 🔹 unified resolution logic (SAME AS BILL SECTION)
                  const customerName =
                    customerFromTable?.name ||
                    (order as Order & { customer_name?: string }).customer_name ||
                    orderProfile.name;

                  const customerPhone =
                    customerFromTable?.phone ||
                    (order as Order & { customer_phone?: string }).customer_phone ||
                    orderProfile.phone;

                  const customerAddress =
                    customerFromTable?.address ||
                    (order as Order & { customer_address?: string }).customer_address ||
                    orderProfile.address;

                  return (
                    <div key={order.id} className="bg-white p-6 rounded-xl shadow-md">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">{customerName}</p>
                          <p className="text-sm text-gray-600">{customerPhone}</p>
                          <p className="text-sm text-gray-600 break-all">
                            {customerAddress || 'Address not provided'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            ₹{order.final_amount || 0}
                          </p>
                          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100">
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {orders.length === 0 && (
                  <div className="bg-white p-12 text-center rounded-xl">
                    <p className="text-gray-600">No payment transactions</p>
                  </div>
                )}
              </div>
            )}
          </div>

        )}


        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  Daily Revenue
                </h3>
                <div className="space-y-4">
                  {dailySales.length > 0 ? (
                    dailySales.map((day) => {
                      const maxSales = Math.max(
                        ...dailySales.map((d) => d.sales)
                      );
                      const percentage = maxSales > 0 ? (day.sales / maxSales) * 100 : 0;

                      return (
                        <div key={day.date}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              {day.date}
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                              ₹{day.sales.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-600">No sales data yet</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  Best Selling Products
                </h3>
                <div className="space-y-4">
                  {orders.length > 0 ? (
                    Object.entries(
                      orders.reduce(
                        (acc, order) => {
                          order.order_items.forEach((item) => {
                            const key = item.products.id;
                            if (!acc[key]) {
                              acc[key] = {
                                name: item.products.name,
                                quantity: 0,
                                revenue: 0,
                              };
                            }
                            acc[key].quantity += item.quantity;
                            acc[key].revenue += item.subtotal;
                          });
                          return acc;
                        },
                        {} as Record<
                          string,
                          {
                            name: string;
                            quantity: number;
                            revenue: number;
                          }
                        >
                      )
                    )
                      .sort((a, b) => b[1].quantity - a[1].quantity)
                      .slice(0, 5)
                      .map(([, product]) => (
                        <div
                          key={product.name}
                          className="flex items-center justify-between pb-4 border-b border-gray-200 last:border-0"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {product.quantity} sold
                            </p>
                          </div>
                          <p className="font-bold text-blue-600">
                            ₹{product.revenue.toFixed(2)}
                          </p>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-600">No sales data yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Profit Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-600 text-sm">Total Revenue</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    ₹{stats.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Average Order Value</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    ₹
                    {stats.totalOrders > 0
                      ? (stats.totalRevenue / stats.totalOrders).toFixed(2)
                      : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEditOrderModal && editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Edit Order</h2>
              <button
                onClick={closeEditOrderModal}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-3">
                  {editingOrderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {item.products?.name || 'Unknown Product'}
                        </p>
                        <p className="text-sm text-gray-600">
                          ₹{item.price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              updateOrderItemQuantity(item.id, item.quantity - 1)
                            }
                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateOrderItemQuantity(item.id, item.quantity + 1)
                            }
                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>
                        <p className="font-bold text-gray-900 w-24 text-right">
                          ₹{item.subtotal.toFixed(2)}
                        </p>
                        <button
                          onClick={() => removeOrderItem(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {editingOrderItems.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No items in this order
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">
                      ₹{recalculateOrderTotals().subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery Charge</span>
                    <span className="text-gray-900">
                      ₹{recalculateOrderTotals().deliveryCharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-green-600">
                      -₹{recalculateOrderTotals().discount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span className="text-gray-900">Final Amount</span>
                    <span className="text-blue-600">
                      ₹{recalculateOrderTotals().finalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={saveOrderChanges}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
                <button
                  onClick={closeEditOrderModal}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button
                onClick={closeProductModal}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={(e) => {
              e.preventDefault();
              handleSaveProduct();
            }}>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Product Image</label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    setSelectedImage(file);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                  className="border p-2 rounded"
                />

                {/* Image preview */}
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 object-cover rounded border"
                  />
                )}
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Selling Unit Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) =>
                    setProductForm({ ...productForm, price: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRP (Maximum Retail Price)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={productForm.mrp}
                  onChange={(e) =>
                    setProductForm({ ...productForm, mrp: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item ID (optional)
                </label>
                <input
                  type="number"
                  value={productForm.item_id}
                  onChange={(e) =>
                    setProductForm({ ...productForm, item_id: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Leave empty to auto-generate"
                  min={1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use this to set a specific numeric Item ID; otherwise it will be assigned automatically.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={productForm.category}
                  onChange={(e) =>
                    setProductForm({ ...productForm, category: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., Electronics, Clothing, Books"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Add a category to help users filter products
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock
                </label>
                <input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) =>
                    setProductForm({ ...productForm, stock: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkUploadModal && (
        <BulkProductUpload
          onClose={() => setShowBulkUploadModal(false)}
          onSuccess={() => {
            fetchProducts();
            calculateStats();
          }}
        />
      )}
    </div>
  );
}
