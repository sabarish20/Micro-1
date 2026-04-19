"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, ShoppingBag } from "lucide-react";
import { getOrders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OrderCard from "@/components/OrderCard";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const { token, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      router.push("/login");
      return;
    }

    getOrders(token)
      .then(setOrders)
      .catch(() => setError("Failed to load orders. Please try again."))
      .finally(() => setLoading(false));
  }, [token, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-blue-50 rounded-xl">
          <Package className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          {user && (
            <p className="text-sm text-gray-500">Logged in as {user.email}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {orders.length === 0 && !error ? (
        <div className="text-center py-24 text-gray-400">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium text-lg text-gray-600">No orders yet</p>
          <p className="text-sm mt-1">Head to the catalog and place your first order!</p>
          <button onClick={() => router.push("/")} className="btn-primary mt-6">
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdate={(updated) =>
                setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
