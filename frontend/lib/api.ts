import axios from "axios";
import type {
  AuthResponse,
  Order,
  PaginatedProducts,
  Product,
  Category,
} from "./types";

const USER_URL = process.env.NEXT_PUBLIC_USER_SERVICE_URL ?? "http://localhost:8081";
const PRODUCT_URL = process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ?? "http://localhost:8000";
const ORDER_URL = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL ?? "http://localhost:8082";

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Coerce API product payload so stock / image / price always match frontend expectations. */
function normalizeProduct(raw: unknown): Product {
  const p = raw as Product & {
    stockQuantity?: number;
    imageUrl?: string | null;
  };
  const sq = p.stock_quantity ?? p.stockQuantity;
  let stock_quantity = 0;
  if (typeof sq === "number" && Number.isFinite(sq)) {
    stock_quantity = Math.max(0, Math.floor(sq));
  } else if (typeof sq === "string" && sq.trim() !== "") {
    const n = parseInt(sq, 10);
    if (Number.isFinite(n)) stock_quantity = Math.max(0, n);
  }
  const image_url =
    (p.image_url ?? p.imageUrl) === undefined || (p.image_url ?? p.imageUrl) === null
      ? null
      : String(p.image_url ?? p.imageUrl);
  const price = typeof p.price === "string" ? p.price : String(p.price ?? "0");
  return { ...p, price, stock_quantity, image_url };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(data: {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthResponse> {
  const res = await axios.post<AuthResponse>(`${USER_URL}/api/auth/register`, data);
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await axios.post<AuthResponse>(`${USER_URL}/api/auth/login`, { email, password });
  return res.data;
}

export async function getProfile(token: string) {
  const res = await axios.get(`${USER_URL}/api/users/me`, { headers: authHeader(token) });
  return res.data;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(params?: {
  page?: number;
  size?: number;
  category_id?: string;
  search?: string;
}): Promise<PaginatedProducts> {
  const res = await axios.get<PaginatedProducts>(`${PRODUCT_URL}/api/products`, { params });
  return {
    ...res.data,
    items: res.data.items.map(normalizeProduct),
  };
}

export async function getProduct(id: string): Promise<Product> {
  const res = await axios.get<Product>(`${PRODUCT_URL}/api/products/${id}`);
  return normalizeProduct(res.data);
}

export async function getCategories(): Promise<Category[]> {
  const res = await axios.get<Category[]>(`${PRODUCT_URL}/api/categories`);
  return res.data;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function createOrder(
  token: string,
  data: {
    items: { productId: string; quantity: number }[];
    shippingAddress?: string;
  }
): Promise<Order> {
  const res = await axios.post<Order>(`${ORDER_URL}/api/orders`, data, {
    headers: authHeader(token),
  });
  return res.data;
}

export async function getOrders(token: string): Promise<Order[]> {
  const res = await axios.get<Order[]>(`${ORDER_URL}/api/orders`, {
    headers: authHeader(token),
  });
  return res.data;
}

export async function getOrder(token: string, orderId: string): Promise<Order> {
  const res = await axios.get<Order>(`${ORDER_URL}/api/orders/${orderId}`, {
    headers: authHeader(token),
  });
  return res.data;
}

export async function cancelOrder(token: string, orderId: string): Promise<Order> {
  const res = await axios.post<Order>(
    `${ORDER_URL}/api/orders/${orderId}/cancel`,
    {},
    { headers: authHeader(token) }
  );
  return res.data;
}
