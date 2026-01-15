import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase, Order, OrderItem, Product } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills';

interface BillsProps {
  onNavigate: (page: Page) => void;
}

type OrderWithItems = Order & { order_items: (OrderItem & { products?: Product })[] };

export default function Bills({ onNavigate }: BillsProps) {
  const { profile } = useAuth();
  const [bills, setBills] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState<OrderWithItems | null>(null);

  const fetchBills = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            subtotal,
            products (
              id,
              name,
              price
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBills((data as OrderWithItems[]) ?? []);
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const printBill = (bill: OrderWithItems) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      alert('Popup blocked. Please allow popups to print.');
      return;
    }

    const rows = (bill.order_items || []).map((it) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${String(it.products?.name || 'Unknown Product')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${it.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${Number(it.price ?? it.products?.price ?? 0).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${Number(it.subtotal).toFixed(2)}</td>
      </tr>
    `).join('');

    w.document.write(`
      <html>
        <head>
          <title>Order ${bill.id}</title>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h1 style="margin:0;">Invoice</h1>
          <div style="margin-top:8px;color:#555;">Order: <strong>${bill.id}</strong></div>
          <div style="margin-top:4px;color:#555;">Date: ${new Date(bill.created_at).toLocaleString()}</div>

          <h2 style="margin-top:24px;">Items</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Item</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Qty</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Price</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div style="margin-top:24px;display:flex;justify-content:flex-end;">
            <div style="min-width:320px;">
              <div style="display:flex;justify-content:space-between;margin:6px 0;"><span>Subtotal</span><span>$${Number(bill.total_amount).toFixed(2)}</span></div>
              <div style="display:flex;justify-content:space-between;margin:6px 0;"><span>Delivery</span><span>$${Number(bill.delivery_charge).toFixed(2)}</span></div>
              <div style="display:flex;justify-content:space-between;margin:6px 0;"><span>Discount</span><span>-$${Number(bill.discount).toFixed(2)}</span></div>
              <div style="display:flex;justify-content:space-between;margin:12px 0;padding-top:12px;border-top:2px solid #ddd;font-weight:bold;font-size:18px;">
                <span>Total</span><span>$${Number(bill.final_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => (selectedBill ? setSelectedBill(null) : onNavigate('home'))}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {selectedBill ? 'Back to Bills' : 'Back'}
          </button>
          <h1 className="text-xl font-bold text-gray-900">Your Bills</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!selectedBill ? (
          <>
            {bills.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                <p className="text-gray-600">No bills found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bills.map((bill) => (
                  <button
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className="w-full bg-white rounded-xl shadow-md p-6 text-left hover:shadow-lg transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-900">Order {bill.id.slice(0, 8)}…</p>
                        <p className="text-sm text-gray-600">
                          {new Date(bill.created_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          Items: {bill.order_items?.length || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          ₹{Number(bill.final_amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Order {selectedBill.id.slice(0, 8)}…</h2>
                <p className="text-sm text-gray-600">
                  {new Date(selectedBill.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => printBill(selectedBill)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Print
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {selectedBill.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.products?.name || 'Unknown Product'} × {item.quantity}
                  </span>
                  <span className="font-semibold text-gray-900">
                    ₹{Number(item.subtotal).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">₹{Number(selectedBill.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery</span>
                <span className="text-gray-900">₹{Number(selectedBill.delivery_charge).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="text-green-600">-₹{Number(selectedBill.discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span className="text-gray-900">Total</span>
                <span className="text-blue-600">₹{Number(selectedBill.final_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
