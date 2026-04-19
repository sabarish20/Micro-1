"use client";

import Link from "next/link";
import { ShoppingCart, BookOpen } from "lucide-react";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { addItem } = useCart();

  return (
    <div className="card hover:shadow-md transition-shadow duration-200 flex flex-col overflow-hidden group">
      {/* Cover */}
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 h-52 flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-blue-300">
              <BookOpen className="w-16 h-16" />
            </div>
          )}
          {product.stock_quantity === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="badge bg-red-500 text-white text-sm px-3 py-1">Out of Stock</span>
            </div>
          )}
          {product.category && (
            <div className="absolute top-2 left-2">
              <span className="badge bg-white/90 text-blue-700 shadow-sm text-xs">
                {product.category.name}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/products/${product.id}`} className="group/link">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover/link:text-blue-600 transition-colors">
            {product.name}
          </h3>
        </Link>
        {product.author && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{product.author}</p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-gray-900">
            ${parseFloat(product.price).toFixed(2)}
          </span>
          <button
            onClick={() => addItem(product)}
            disabled={product.stock_quantity === 0}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
          <p className="text-xs text-amber-600 mt-1">
            Only {product.stock_quantity} left!
          </p>
        )}
      </div>
    </div>
  );
}
