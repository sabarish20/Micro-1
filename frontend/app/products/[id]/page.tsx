"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingCart,
  BookOpen,
  Tag,
  Package,
  Hash,
  Loader2,
} from "lucide-react";
import { getProduct } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import BookCoverImage from "@/components/BookCoverImage";
import type { Product } from "@/lib/types";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getProduct(params.id as string)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="font-medium text-lg">Product not found</p>
        <button onClick={() => router.push("/")} className="btn-primary mt-4">
          Back to Catalog
        </button>
      </div>
    );
  }

  const maxQty = Math.min(product.stock_quantity, 10);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to catalog
      </button>

      <div className="grid md:grid-cols-5 gap-10">
        {/* Cover */}
        <div className="md:col-span-2">
          <div className="card overflow-hidden aspect-[3/4] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
            <BookCoverImage
              imageUrl={product.image_url}
              alt={product.name}
              imgClassName="w-full h-full object-cover"
              fallback={<BookOpen className="w-24 h-24 text-blue-200" />}
            />
          </div>
        </div>

        {/* Details */}
        <div className="md:col-span-3 space-y-5">
          {product.category && (
            <span className="badge bg-blue-50 text-blue-700">
              <Tag className="w-3 h-3 mr-1" />
              {product.category.name}
            </span>
          )}

          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            {product.author && (
              <p className="text-gray-500 mt-1 text-lg">by {product.author}</p>
            )}
          </div>

          <p className="text-3xl font-bold text-gray-900">
            ${parseFloat(product.price).toFixed(2)}
          </p>

          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              {product.stock_quantity > 0 ? (
                <span className={product.stock_quantity <= 5 ? "text-amber-600 font-medium" : ""}>
                  {product.stock_quantity <= 5
                    ? `Only ${product.stock_quantity} left`
                    : `${product.stock_quantity} in stock`}
                </span>
              ) : (
                <span className="text-red-600 font-medium">Out of stock</span>
              )}
            </div>
            {product.isbn && (
              <div className="flex items-center gap-1.5">
                <Hash className="w-4 h-4" />
                ISBN: {product.isbn}
              </div>
            )}
          </div>

          {/* Add to cart */}
          {product.stock_quantity > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-50 border-r text-gray-600"
                >
                  −
                </button>
                <span className="px-4 py-2 font-medium text-gray-900 min-w-[3rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  className="px-3 py-2 hover:bg-gray-50 border-l text-gray-600"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className={`btn-primary flex-1 ${added ? "bg-green-600 hover:bg-green-700" : ""}`}
              >
                <ShoppingCart className="w-4 h-4" />
                {added ? "Added to Cart!" : "Add to Cart"}
              </button>
            </div>
          )}

          <div className="pt-2 text-xs text-gray-400">
            Product ID: <span className="font-mono">{product.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
