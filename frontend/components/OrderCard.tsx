"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, XCircle, Loader2 } from "lucide-react";
import { cancelOrder } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface Props {
  order: Order;
  onUpdate: (updated: Order) => void;
}

export default function OrderCard({ order, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { token } = useAuth();

  const handleCancel = async () => {
    if (!token || !confirm("Cancel this order?")) return;
    setCancelling(true);
    try {
      const updated = await cancelOrder(token, order.id);
      onUpdate(updated);
    } catch {
      alert("Failed to cancel order.");
    } finally {
      setCancelling(false);
    }
  };

  const date = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-gray-500 truncate">
              #{order.id.split("-")[0].toUpperCase()}
            </span>
            <span className={`badge ${STATUS_STYLES[order.status]}`}>{order.status}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-900 text-lg">
            ${parseFloat(order.totalAmount).toFixed(2)}
          </span>
          {order.status === "PENDING" && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn-danger text-xs py-1.5 px-3"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Cancel
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-3">
          {order.shippingAddress && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Ship to:</span> {order.shippingAddress}
            </p>
          )}
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="w-8 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded flex items-center justify-center text-xs flex-shrink-0">
                📚
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                {item.productAuthor && (
                  <p className="text-xs text-gray-500 truncate">{item.productAuthor}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-medium">${parseFloat(item.lineTotal).toFixed(2)}</p>
                <p className="text-xs text-gray-500">
                  {item.quantity} × ${parseFloat(item.unitPrice).toFixed(2)}
                </p>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>${parseFloat(order.totalAmount).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
