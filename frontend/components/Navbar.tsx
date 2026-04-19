"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, BookOpen, User, LogOut, Package, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import CartSidebar from "./CartSidebar";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
    setMenuOpen(false);
  };

  return (
    <>
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
              <BookOpen className="w-6 h-6" />
              ShopNative
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                Catalog
              </Link>
              {user && (
                <Link
                  href="/orders"
                  className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <Package className="w-4 h-4" />
                  Orders
                </Link>
              )}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              {/* Cart Button */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Open cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </button>

              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Hi, <span className="font-medium text-gray-900">{user.username}</span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="btn-secondary text-sm py-1.5 px-3"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="btn-secondary text-sm py-1.5 px-3">
                    <User className="w-4 h-4" />
                    Login
                  </Link>
                  <Link href="/register" className="btn-primary text-sm py-1.5 px-3">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile: cart + menu */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-2">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="block text-sm font-medium text-gray-700 py-2"
            >
              Catalog
            </Link>
            {user && (
              <Link
                href="/orders"
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-gray-700 py-2"
              >
                My Orders
              </Link>
            )}
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full text-left text-sm font-medium text-red-600 py-2"
              >
                Logout ({user.username})
              </button>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm flex-1 text-center">
                  Login
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-sm flex-1 text-center">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
