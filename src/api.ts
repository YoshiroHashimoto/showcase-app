// APIベースURL: デプロイ後は実際のWebDev公開 URLに変更してください
export const API_BASE_URL = "https://3000-ild7hdkgbqkqho4fz2agj-72b70e0a.sg1.manus.computer";

async function trpcQuery<T>(procedure: string, input?: unknown): Promise<T> {
  const url = `${API_BASE_URL}/api/trpc/${procedure}`;
  const params = input !== undefined ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "";
  const res = await fetch(`${url}${params}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result?.data as T;
}

async function trpcMutation<T>(procedure: string, input: unknown): Promise<T> {
  const url = `${API_BASE_URL}/api/trpc/${procedure}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result?.data as T;
}

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export type Category = {
  id: number;
  name: string;
  sortOrder: number;
};

export type Dish = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isActive: number;
  sortOrder: number;
};

export type NewsItem = {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  isActive: number;
  sortOrder: number;
};

export type OrderItem = {
  dishId: number;
  dishName: string;
  price: string;
  quantity: number;
};

// ─── API関数 ──────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  return trpcQuery<Category[]>("categories.list");
}

export async function fetchActiveDishes(): Promise<Dish[]> {
  return trpcQuery<Dish[]>("dishes.listActive");
}

export async function fetchActiveNews(): Promise<NewsItem[]> {
  return trpcQuery<NewsItem[]>("news.listActive");
}

export async function createOrder(items: OrderItem[], note?: string): Promise<{ orderNumber: string; token: string }> {
  return trpcMutation("orders.create", { items, note });
}

export function getStatusUrl(token: string): string {
  return `${API_BASE_URL}/status?token=${token}`;
}
