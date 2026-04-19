"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ShoppingCart, Trash2, Plus, Minus, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { createOrder } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartSidebar({ open, onClose }: Props) {
  const { items, totalPrice, removeItem, updateQuantity, clearCart } = useCart();
  const { token } = useAuth();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");

  const handleCheckout = async () => {
    if (!token) {
      onClose();
      router.push("/login");
      return;
    }

    if (items.length === 0) return;

    setPlacing(true);
    setError(null);

    try {
      await createOrder(token, {
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        shippingAddress: shippingAddress || undefined,
      });
      clearCart();
      onClose();
      router.push("/orders");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to place order. Please try again.";
      setError(msg);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Cart
            {items.length > 0 && (
              <span className="badge bg-blue-100 text-blue-700">{items.length}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <ShoppingCart className="w-16 h-16 opacity-30" />
              <p className="text-sm font-medium">Your cart is empty</p>
              <p className="text-xs">Browse the catalog and add some books!</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex gap-3 p-3 card">
                {/* Book cover placeholder */}
                <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-indigo-200 rounded flex-shrink-0 flex items-center justify-center text-xs text-blue-600 font-bold">
                  📚
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                  {item.product.author && (
                    <p className="text-xs text-gray-500 truncate">{item.product.author}</p>
                  )}
                  <p className="text-sm font-semibold text-blue-600 mt-1">
                    ${parseFloat(item.product.price).toFixed(2)}
                  </p>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="ml-auto p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-5 py-4 space-y-3">
            <input
              type="text"
              placeholder="Shipping address (optional)"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="input text-sm"
            />

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-lg font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={placing}
              className="btn-primary w-full"
            >
              {placing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Placing Order...
                </>
              ) : (
                "Place Order"
              )}
            </button>

            <button onClick={clearCart} className="w-full text-xs text-gray-400 hover:text-gray-600">
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
