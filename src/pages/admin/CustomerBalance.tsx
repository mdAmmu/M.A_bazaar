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

type LedgerEntry = {
  id: string;
  type: "order" | "payment";
  amount: number;
  created_at: string;
  method?: string;
};

export default function CustomerBalance() {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerWithBalance | null>(null);

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

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
      .eq("customer_id", customer.id);

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customer.id);

    const combined: LedgerEntry[] = [
      ...(orders || []).map((o) => ({
        id: o.id,
        type: "order",
        amount: o.final_amount,
        created_at: o.created_at,
      })),
      ...(payments || []).map((p) => ({
        id: p.id,
        type: "payment",
        amount: p.amount,
        created_at: p.created_at,
        method: p.payment_method,
      })),
    ].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );

    setLedgerEntries(combined);
  };

  const addPayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;

    await supabase.from("payments").insert([
      {
        customer_id: selectedCustomer.id,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
      },
    ]);

    setPaymentAmount("");
    setPaymentMethod("");

    await openLedger(selectedCustomer);
    await fetchCustomerBalances();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("payments").delete().eq("id", id);
    setLedgerEntries((prev) => prev.filter((e) => e.id !== id));
    await fetchCustomerBalances();
  };

  const handleEditSave = async (id: string) => {
    await supabase
      .from("payments")
      .update({ amount: Number(editAmount) })
      .eq("id", id);

    setLedgerEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, amount: Number(editAmount) } : e
      )
    );

    setEditId(null);
    setEditAmount("");
    await fetchCustomerBalances();
  };

  const renderLedger = () => {
    if (!selectedCustomer) return null;

    let runningBalance = 0;

    return (
      <div className="space-y-3">
        <div className="bg-white shadow rounded-lg p-4">
          <h4 className="font-semibold mb-3">Add Payment</h4>
          <div className="flex flex-row sm:flex-row gap-3">
            <input
              type="number"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="border p-2 rounded w-full sm:w-32"
            />
            <input
              type="text"
              placeholder="Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="border p-2 rounded w-full"
            />
            <button
              onClick={addPayment}
              className="bg-green-600 text-white px-4 py-2 rounded w-full sm:w-auto"
            >
              Save
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <button
            onClick={() => setSelectedCustomer(null)}
            className="mb-4 bg-gray-600 text-white px-2 py-1 rounded"
          >
            ← Back
          </button>

          {ledgerEntries.map((entry) => {
            runningBalance +=
              entry.type === "order"
                ? entry.amount
                : -entry.amount;

            const isActive = activeId === entry.id;
            const isEditing = editId === entry.id;

            return (
              <div key={entry.id} className="border-b py-3">
                <div
                  className="flex flex-col sm:flex-row sm:justify-between cursor-pointer"
                  onClick={() =>
                    entry.type === "payment"
                      ? setActiveId(isActive ? null : entry.id)
                      : null
                  }
                >
                  <div>
                    {new Date(entry.created_at).toLocaleDateString()} -{" "}
                    {entry.type === "order"
                      ? "Order"
                      : `Payment (${entry.method || "N/A"})`}
                  </div>

                  <div className="flex gap-6">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) =>
                          setEditAmount(e.target.value)
                        }
                        className="border p-1 rounded w-24"
                      />
                    ) : (
                      <span
                        className={
                          entry.type === "order"
                            ? "text-blue-600"
                            : "text-green-600"
                        }
                      >
                        {entry.type === "order" ? "+" : "-"}₹
                        {entry.amount}
                      </span>
                    )}

                    <span className="font-bold">
                      ₹{runningBalance}
                    </span>
                  </div>
                </div>

                {isActive && entry.type === "payment" && (
                  <div className="flex gap-2 mt-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() =>
                            handleEditSave(entry.id)
                          }
                          className="bg-blue-600 text-white px-3 py-1 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="bg-gray-400 text-white px-3 py-1 rounded"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditId(entry.id);
                            setEditAmount(
                              entry.amount.toString()
                            );
                          }}
                          className="bg-yellow-500 text-white px-3 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(entry.id)
                          }
                          className="bg-red-600 text-white px-3 py-1 rounded"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!selectedCustomer &&
        customers.map((c) => (
          <div
            key={c.id}
            onClick={() => openLedger(c)}
            className="p-4 border rounded cursor-pointer bg-white shadow-sm"
          >
            <p className="font-semibold">{c.name}</p>
            <p>Total: ₹{c.totalOrders}</p>
            <p>Balance: ₹{c.balance}</p>
          </div>
        
        ))}

      {selectedCustomer && renderLedger()}
    </div>
  );
}
