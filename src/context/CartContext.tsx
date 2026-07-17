import React, { createContext, useCallback, useContext, useState } from "react";

export type CartItem = {
  dishId: number;
  dishName: string;
  price: string;
  quantity: number;
};

type CartContextType = {
  cart: CartItem[];
  totalItems: number;
  totalAmount: number;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (dishId: number) => void;
  deleteFromCart: (dishId: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.dishId === item.dishId);
      if (existing) {
        return prev.map((i) =>
          i.dishId === item.dishId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((dishId: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.dishId === dishId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((i) => i.dishId !== dishId);
      return prev.map((i) => (i.dishId === dishId ? { ...i, quantity: i.quantity - 1 } : i));
    });
  }, []);

  const deleteFromCart = useCallback((dishId: number) => {
    setCart((prev) => prev.filter((i) => i.dishId !== dishId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = cart.reduce((sum, i) => sum + parseInt(i.price) * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, totalItems, totalAmount, addToCart, removeFromCart, deleteFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
