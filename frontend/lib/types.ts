export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  author: string | null;
  description: string | null;
  price: string;
  stock_quantity: number;
  image_url: string | null;
  isbn: string | null;
  is_active: boolean;
  category_id: string | null;
  category: Category | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: User;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productAuthor: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: string;
  shippingAddress: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
