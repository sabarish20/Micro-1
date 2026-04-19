import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ShopNative — Cloud-Native Bookstore",
  description: "A microservices-powered bookstore built for the cloud.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CartProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="bg-white border-t py-8 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
                  <p>
                    <span className="font-semibold text-gray-700">ShopNative</span> —
                    A cloud-native microservices demo built with FastAPI, Spring Boot &amp; Next.js
                  </p>
                  <p className="mt-1">
                    Services: product-service :8000 · user-service :8081 · order-service :8082
                  </p>
                </div>
              </footer>
            </div>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
