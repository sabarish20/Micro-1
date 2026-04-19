"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, SlidersHorizontal, Loader2, BookOpen } from "lucide-react";
import { getProducts, getCategories } from "@/lib/api";
import type { PaginatedProducts, Category } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const [data, setData] = useState<PaginatedProducts | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProducts({
        page,
        size: 12,
        search: search || undefined,
        category_id: categoryId || undefined,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategory = (id: string) => {
    setCategoryId(id);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-2 rounded-full mb-4">
          <BookOpen className="w-4 h-4" />
          Cloud-Native Microservices Demo
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          ShopNative Bookstore
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Discover the best books on programming, DevOps, architecture, and more.
          Powered by FastAPI, Spring Boot &amp; Next.js.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or author..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="flex items-center gap-2 sm:w-56">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={categoryId}
            onChange={(e) => handleCategory(e.target.value)}
            className="input"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results header */}
      {data && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {data.total} {data.total === 1 ? "book" : "books"} found
          </p>
          {(search || categoryId) && (
            <button
              onClick={() => { setSearch(""); setCategoryId(""); setPage(1); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-12">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm py-1.5 px-4"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {data.page} of {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="btn-secondary text-sm py-1.5 px-4"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-24 text-gray-400">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No books found</p>
          {(search || categoryId) && (
            <p className="text-sm mt-1">Try adjusting your filters</p>
          )}
        </div>
      )}
    </div>
  );
}
