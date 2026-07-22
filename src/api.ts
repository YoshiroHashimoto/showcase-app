// APIベースURL
export const API_BASE_URL = "https://cakemanage-wwq7fcan.manus.space";

// tRPCはSuperjsonを使うため、レスポンスは result.data.json に実データが入る
async function trpcQuery<T>(procedure: string, input?: unknown): Promise<T> {
  const url = `${API_BASE_URL}/api/trpc/${procedure}`;
  const params = input !== undefined ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "";
  const res = await fetch(`${url}${params}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Unknown error");
  // Superjson形式: result.data.json に実データ、result.data が直接配列の場合も対応
  const data = json.result?.data;
  if (data && typeof data === "object" && "json" in data) {
    return data.json as T;
  }
  return data as T;
}

async function trpcMutation<T>(procedure: string, input: unknown): Promise<T> {
  const url = `${API_BASE_URL}/api/trpc/${procedure}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Unknown error");
  const data = json.result?.data;
  if (data && typeof data === "object" && "json" in data) {
    return data.json as T;
  }
  return data as T;
}

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export type Category = {
  id: number;
  name: string;
  sortOrder: number;
};

export type Dish = {
  id: number;
  category: string;       // CMSは categoryId ではなく category（文字列）を返す
  name: string;
  description: string | null;
  price: number;          // CMSはnumber型で返す
  imageUrl: string | null;
  detailImageUrl: string | null;  // 詳細モーダル用画像（未設定の場合はimageUrlを使用）
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
  price: number;
  quantity: number;
};

// ─── API関数 ──────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  return trpcQuery<Category[]>("categories.list");
}

// App.tsxが呼ぶ関数名に合わせる
export async function fetchAllDishes(): Promise<Dish[]> {
  return trpcQuery<Dish[]>("dishes.list");
}

// 後方互換
export async function fetchActiveDishes(): Promise<Dish[]> {
  return fetchAllDishes();
}

export async function fetchActiveNews(): Promise<NewsItem[]> {
  return trpcQuery<NewsItem[]>("news.active");
}

export async function createOrder(
  items: OrderItem[],
  candleLarge?: number,
  candleSmall?: number,
  notes?: string
): Promise<{ orderNumber: string; token: string }> {
  return trpcMutation("orders.create", {
    items,
    candleLarge: candleLarge ?? 0,
    candleSmall: candleSmall ?? 0,
    notes: notes ?? "",
  });
}

export async function registerPushToken(token: string, platform?: string): Promise<void> {
  await trpcMutation("push.registerToken", { token, platform });
}

export function getStatusUrl(token: string): string {
  return `${API_BASE_URL}/status?token=${token}`;
}
