import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Props {
  order: any;
  products: any[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditOrderModal({
  order,
  products,
  open,
  onClose,
  onSaved,
}: Props) {
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [showProductList, setShowProductList] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // ===== Load Order =====
  useEffect(() => {
    if (!order) return;

    setDeliveryCharge(Number(order.delivery_charge) || 0);
    setDiscount(Number(order.discount) || 0);

    setEditingItems(
      (order.order_items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id || item.products?.id,
        products: item.products,
        quantity: Number(item.quantity),
        price: Number(item.price),
      }))
    );
  }, [order]);

  if (!open || !order) return null;

  // ===== Helpers =====

  const calculateSubtotal = () =>
    editingItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

  const calculateFinalAmount = () =>
    Math.max(calculateSubtotal() + deliveryCharge - discount, 0);

  // ===== Qty Controls =====

  const increaseQty = (productId: string) => {
    setEditingItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQty = (itemId: string) => {
    setEditingItems((prev) =>
      prev
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(item.quantity - 1, 0) }
            : item
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const addProductToOrder = (product: any) => {
    setEditingItems((prev) => {
      const existing = prev.find((p) => p.product_id === product.id);

      if (existing) {
        return prev.map((p) =>
          p.product_id === product.id
            ? { ...p, quantity: p.quantity + 1 }
            : p
        );
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          product_id: product.id,
          products: product,
          quantity: 1,
          price: product.price,
        },
      ];
    });
  };


  // ===== Save =====
  const saveEditedOrder = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Saving as user:", user?.id);
      console.log("Current Auth User ID:", user?.id); // Added this line
      console.log("Current Auth User Profile (Metadata):", user?.user_metadata);
      console.log("Current Auth User Role:", user?.role); // Added this line
      console.log("Full order object:", order); // Added this line
      console.log("Order Employee ID:", order.employee_id);

      const subtotal = calculateSubtotal();
      const finalAmount = calculateFinalAmount();

      console.log("Saving edited order:", {
        id: order.id,
        subtotal,
        deliveryCharge,
        discount,
        finalAmount,
        itemsCount: editingItems.length
      });

      // 1. Delete old items
      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);

      if (deleteError) {
        console.error("Delete items error:", deleteError);
        throw new Error(`Failed to remove old items: ${deleteError.message}`);
      }

      // 2. Insert new items
      const { error: insertError } = await supabase.from("order_items").insert(
        editingItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.quantity * item.price,
        }))
      );

      if (insertError) {
        console.error("Insert items error:", insertError);
        throw new Error(`Failed to add new items: ${insertError.message}`);
      }

      // 3. Update order
      const { data: updatedData, error: updateError } = await supabase
        .from("orders")
        .update({
          total_amount: subtotal,
          delivery_charge: deliveryCharge,
          discount: discount,
          final_amount: finalAmount,
          status: "edited",
        })
        .eq("id", order.id)
        .select();

      if (updateError) {
        console.error("Update order error:", updateError);
        throw new Error(`Failed to update order totals: ${updateError.message}`);
      }

      if (!updatedData || updatedData.length === 0) {
        console.error("Update matched 0 rows. Likely RLS issue.");
        throw new Error("Permission Denied: Database blocked the update. Please check RLS policies.");
      }

      console.log("Order updated successfully. Database response:", updatedData);

      alert("Order updated successfully!");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      alert(err.message || "Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  // ===== UI =====
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Order</h2>

        {/* Add Product */}
        <button
          onClick={() => setShowProductList(!showProductList)}
          className="border px-3 py-2 w-full text-left mb-3"
        >
          Add Product
        </button>

        {showProductList && (
          <div className="border rounded mb-3 max-h-60 overflow-y-auto">
            <input
              className="w-full p-2 border-b"
              placeholder="Search..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />

            {products
              .filter(
                (p) =>
                  p.name
                    .toLowerCase()
                    .includes(productSearch.toLowerCase()) ||
                  p.id.toLowerCase().includes(productSearch.toLowerCase())
              )
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => addProductToOrder(p)}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                >
                  {p.name} — ₹{p.price}
                </div>
              ))}
          </div>
        )}

        {/* Items */}
        {editingItems.map((item) => (
          <div
            key={item.id}
            className="flex justify-between bg-gray-50 p-2 rounded mb-2"
          >
            <span>{item.products?.name}</span>

            <div className="flex gap-2">
              <button onClick={() => decreaseQty(item.id)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => increaseQty(item.product_id)}>+</button>
            </div>
          </div>
        ))}

        {/* Delivery / Discount */}
        <div className="mt-3">
          <input
            type="number"
            placeholder="Delivery Charge"
            value={deliveryCharge}
            onChange={(e) => setDeliveryCharge(Number(e.target.value))}
            className="border p-2 w-full mb-2"
          />

          <input
            type="number"
            placeholder="Discount"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="border p-2 w-full"
          />
        </div>

        {/* Total */}
        <div className="text-right font-bold text-lg text-blue-600 mt-3">
          Total: ₹{calculateFinalAmount()}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={saveEditedOrder}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-green-300"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>

          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}