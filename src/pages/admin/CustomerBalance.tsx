import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string;
};

type Order = {
  id: string;
  customer_id: string;
  final_amount: number;
  created_at: string;
};

type Payment = {
  id: string;
  customer_id: string;
  amount: number;
  payment_method?: string;
  note?: string;
  created_at: string;
};

type CustomerWithBalance = Customer & {
  totalOrders: number;
  totalPayments: number;
  balance: number;
};

/* ✅ Ledger Entry Type */
type LedgerEntry = {
  type: "order" | "payment";
  amount: number;
  created_at: string;
  method?: string;
};

export default function CustomerBalance() {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerWithBalance | null>(null);
  const [ledgerOrders, setLedgerOrders] = useState<Order[]>([]);
  const [ledgerPayments, setLedgerPayments] = useState<Payment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  useEffect(() => {
    fetchCustomerBalances();
  }, []);

  const fetchCustomerBalances = async () => {
    const { data: customersData } = await supabase.from("customers").select("*");
    const { data: ordersData } = await supabase
      .from("orders")
      .select("customer_id, final_amount");
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("customer_id, amount");

    const processed = (customersData || []).map((customer: Customer) => {
      const totalOrders =
        ordersData
          ?.filter((o) => o.customer_id === customer.id)
          .reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0;

      const totalPayments =
        paymentsData
          ?.filter((p) => p.customer_id === customer.id)
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return {
        ...customer,
        totalOrders,
        totalPayments,
        balance: totalOrders - totalPayments,
      };
    });

    setCustomers(processed);
  };

  const openLedger = async (customer: CustomerWithBalance) => {
    setSelectedCustomer(customer);

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: true });

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: true });

    setLedgerOrders(orders || []);
    setLedgerPayments(payments || []);
  };

  const addPayment = async () => {
    if (!selectedCustomer) return;

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("Enter valid amount");
      return;
    }

    const { error } = await supabase.from("payments").insert([
      {
        customer_id: selectedCustomer.id,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
      },
    ]);

    if (error) {
      alert("Error saving payment");
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("");

    await openLedger(selectedCustomer);
    await fetchCustomerBalances();
  };

  const renderLedger = () => {
    if (!selectedCustomer) return null;

    /* ✅ Typed Combined Ledger */
    const combined: LedgerEntry[] = [
      ...ledgerOrders.map((o) => ({
        type: "order" as const,
        amount: o.final_amount,
        created_at: o.created_at,
      })),
      ...ledgerPayments.map((p) => ({
        type: "payment" as const,
        amount: p.amount,
        created_at: p.created_at,
        method: p.payment_method,
      })),
    ].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );

    let runningBalance = 0;

    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => setSelectedCustomer(null)}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            ← Back
          </button>

          <h3 className="text-xl font-bold">
            {selectedCustomer.name} - Ledger
          </h3>
        </div>

        <div className="space-y-2">
          {combined.map((entry, index) => {
            if (entry.type === "order") {
              runningBalance += entry.amount;
            } else {
              runningBalance -= entry.amount;
            }

            return (
              <div
                key={index}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <div>
                  {new Date(entry.created_at).toLocaleDateString()} -{" "}
                  {entry.type === "order" ? (
                    "Order"
                  ) : (
                    <>
                      Payment{" "}
                      <span className="text-gray-500 text-xs">
                        ({entry.method || "N/A"})
                      </span>
                    </>
                  )}
                </div>

                <div className="flex gap-6">
                  <span
                    className={
                      entry.type === "order"
                        ? "text-blue-600 font-medium"
                        : "text-green-600 font-medium"
                    }
                  >
                    {entry.type === "order" ? "+" : "-"}₹
                    {entry.amount.toFixed(2)}
                  </span>

                  <span className="font-bold">
                    ₹{runningBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 border-t pt-4">
          <h4 className="font-semibold mb-3">Add Payment</h4>

          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="border p-2 rounded w-32"
            />

            <input
              type="text"
              placeholder="Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="border p-2 rounded"
            />

            <button
              onClick={addPayment}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {!selectedCustomer && (
        <>
          <h2 className="text-2xl font-bold mb-6">Customer Balance</h2>

          <div className="space-y-3">
            {customers.map((c) => (
              <div
                key={c.id}
                onClick={() => openLedger(c)}
                className="p-4 border rounded flex justify-between cursor-pointer hover:bg-gray-50 bg-white shadow-sm"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                </div>

                <div className="text-right text-sm">
                  <p>Total: ₹{c.totalOrders.toFixed(2)}</p>
                  <p>Paid: ₹{c.totalPayments.toFixed(2)}</p>
                  <p
                    className={`font-bold ${
                      c.balance > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    Balance: ₹{c.balance.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedCustomer && renderLedger()}
    </div>
  );
}
