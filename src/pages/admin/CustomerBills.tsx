import React, { useMemo, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string;
};

type OrderItem = {
  quantity: number;
  price: number;
  products?: {
    name: string;
  };
};

type Order = {
  id: string;
  created_at: string;
  final_amount: number;
  customers?: Customer;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  order_items?: OrderItem[];
};

type Props = {
  orders: Order[];
};

export default function CustomerBills({ orders }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ================= GET UNIQUE CUSTOMERS =================
  const customers = useMemo(() => {
    const map = new Map<string, Customer>();

    orders.forEach((order) => {
      const customer =
        order.customers || {
          id: order.customer_phone || order.id,
          name: order.customer_name || "Unknown",
          phone: order.customer_phone || "",
          address: order.customer_address || "",
        };

      if (!map.has(customer.id)) {
        map.set(customer.id, customer);
      }
    });

    return Array.from(map.values());
  }, [orders]);

  // ================= FILTER CUSTOMERS =================
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  // ================= CUSTOMER BILLS =================
  const customerOrders = selectedCustomer
    ? orders.filter((o) => {
        const c =
          o.customers ||
          {
            id: o.customer_phone || o.id,
          };
        return c.id === selectedCustomer.id;
      })
    : [];

  return (
    <div className="space-y-4">

      {/* ================= BILL DETAIL VIEW ================= */}
      {selectedOrder && (
        <div>
          <button
            onClick={() => setSelectedOrder(null)}
            className="text-blue-600 mb-3"
          >
            ← Back to Bills
          </button>

          <div className="bg-white rounded-xl shadow p-6 space-y-2">
            <p className="text-sm text-gray-500">
              Order {selectedOrder.id.slice(0, 8)}… ·{" "}
              {new Date(selectedOrder.created_at).toLocaleString()}
            </p>

            <p className="font-semibold text-lg">
              {selectedCustomer?.name}
            </p>
            <p className="text-sm text-gray-600">
              {selectedCustomer?.phone}
            </p>

            <div className="border-t pt-3 mt-3 space-y-1">
              {selectedOrder.order_items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {item.products?.name ?? "Item"} × {item.quantity}
                  </span>
                  <span>
                    ₹{(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 mt-3 text-right font-bold text-blue-600 text-lg">
              ₹{selectedOrder.final_amount}
            </div>
          </div>
        </div>
      )}

      {/* ================= CUSTOMER BILL LIST ================= */}
      {!selectedOrder && selectedCustomer && (
        <div>
          <button
            onClick={() => setSelectedCustomer(null)}
            className="text-blue-600 mb-3"
          >
            ← Back to Customers
          </button>

          <h2 className="text-xl font-bold mb-3">
            Bills of {selectedCustomer.name}
          </h2>

          {customerOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className=" flex justify-between bg-white rounded-xl shadow p-4 mb-3 cursor-pointer hover:bg-gray-50"
            >
              <p className="text-sm text-gray-500">
                {new Date(order.created_at).toLocaleString()}
              </p>
              <p className="font-semibold text-blue-600">
                ₹{order.final_amount}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ================= CUSTOMER LIST ================= */}
      {!selectedCustomer && !selectedOrder && (
        <>
          <h2 className="text-2xl font-bold">Customer Bills</h2>

          <input
            type="text"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          />

          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="bg-white rounded-xl shadow p-4 cursor-pointer hover:bg-gray-50"
              >
                <p className="font-semibold">{customer.name}</p>
                <p className="text-sm text-gray-600">{customer.phone}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
