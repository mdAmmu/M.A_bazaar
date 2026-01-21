import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ArrowLeft } from "lucide-react";

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
  const navigate = onNavigate ?? (() => {});


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

      navigate("adminOrder", order.id);
    } catch (error) {
      console.error("Error creating order:", error);
      alert("Failed to create order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4  w-full">
      <div className="flex items-start mb-5 w-full">
      <button
        onClick={() => navigate("admin")}
        className="flex items-center text-gray-700 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back
      </button>
      
      </div>
      <h2 className="text-xl font-bold flex items-center mb-5">Create Order</h2>

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


