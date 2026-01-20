import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

type Page =
  | "home"
  | "profile"
  | "cart"
  | "checkout"
  | "bills"
  | "admin"
  | "createOrder"
  | "adminOrder";

interface CreateOrderProps {
  onNavigate: (page: Page, id?: string) => void;
}

const CreateOrder = ({ onNavigate }: CreateOrderProps) => {
  const { profile } = useAuth();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const createOrder = async () => {
    if (!profile?.id) {
      alert("You must be logged in as admin to create an order.");
      return;
    }

    if (!form.name || !form.phone) {
      alert("Name and phone are required.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert([
          {
            user_id: profile.id,
            total_amount: 0,
            delivery_charge: 0,
            discount: 0,
            final_amount: 0,
            status: "draft",
            customer_name: form.name,
            customer_phone: form.phone,
            customer_address: form.address,
          },
        ])
        .select()
        .single();

      if (error || !order) {
        throw error || new Error("Order not created");
      }

      onNavigate("adminOrder", order.id);
    } catch (error) {
      console.error("Error creating order:", error);
      alert("Failed to create order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Create Order</h2>

      <input
        className="w-full border p-2 mb-2"
        placeholder="Customer Name"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
        className="w-full border p-2 mb-2"
        placeholder="Phone Number"
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />

      <textarea
        className="w-full border p-2 mb-4"
        placeholder="Address"
        onChange={(e) => setForm({ ...form, address: e.target.value })}
      />

      <button
        onClick={createOrder}
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create Order"}
      </button>
    </div>
  );
};

export default CreateOrder;