import React, { useState } from "react";
import { Navigation } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Capacitor } from "@capacitor/core";
import { AppLauncher } from "@capacitor/app-launcher";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type Order = {
  id: string;
  final_amount: number;
  status: string;
  created_at: string;
  customers?: Customer;
};

type DeliverProps = {
  orders: Order[];
  fetchOrders: () => Promise<void>;
};

export default function Deliver({ orders, fetchOrders }: DeliverProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ✅ Get unique days
  const getDays = () => {
    const days = orders.map((o) =>
      new Date(o.created_at).toLocaleDateString()
    );
    return [...new Set(days)];
  };

  // ✅ Get orders by selected day
  const getOrdersByDay = (day: string) => {
    return orders.filter(
      (o) =>
        new Date(o.created_at).toLocaleDateString() === day
    );
  };

  // ✅ Update delivery status
  const updateStatus = async (id: string, status: string) => {
    await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    await fetchOrders();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Delivery Orders</h2>

      {/* ================= DAY LIST ================= */}
      {!selectedDay ? (
        getDays().map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className="w-full bg-white shadow rounded-lg p-4 text-left hover:bg-gray-50"
          >
            <p className="font-semibold">{day}</p>
            <p className="text-sm text-gray-500">
              {getOrdersByDay(day).length} orders
            </p>
          </button>
        ))
      ) : (
        <div>
          {/* BACK BUTTON */}
          <button
            onClick={() => setSelectedDay(null)}
            className="text-blue-600 mb-4"
          >
            ← Back
          </button>

          {/* ================= ORDER CARDS ================= */}
          {getOrdersByDay(selectedDay).map((order) => {
            const customer = order.customers;

            return (
              <div
                key={order.id}
                className="bg-white shadow rounded-lg p-4 mb-3"
              >
                {/* TOP SECTION */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {customer?.name || "Customer"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {customer?.phone}
                    </p>
                  </div>

                  <p className="font-bold text-blue-600">
                    ₹{order.final_amount}
                  </p>
                </div>

                {/* BOTTOM SECTION */}
                <div className="flex justify-between items-center mt-3">
                  
                  {/* ✅ YOUR ORIGINAL LOCATE BUTTON CODE */}
                  {customer?.latitude != null &&
                    customer?.longitude != null && (
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

                            // 👉 If running inside APK / Mobile
                            if (Capacitor.isNativePlatform()) {
                              const url = `geo:${lat},${lng}?q=${lat},${lng}`;
                              await AppLauncher.openUrl({ url });
                            }

                            // 👉 If running in browser
                            else {
                              const url = `https://www.google.com/maps?q=${lat},${lng}`;
                              window.open(
                                url,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }
                          } catch (error) {
                            console.error("Map open error:", error);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                        title="Open location in Google Maps"
                      >
                        <Navigation className="h-4 w-4" />
                        Locate
                      </button>
                    )}

                  {/* STATUS DROPDOWN */}
                  <select
                    value={order.status}
                    onChange={(e) =>
                      updateStatus(order.id, e.target.value)
                    }
                    className={`border rounded px-3 py-1 text-sm font-medium ${
                      order.status === "delivered"
                        ? "text-green-600 border-green-400"
                        : "text-orange-600 border-orange-400"
                    }`}
                  >
                    <option value="pending">Pending</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
