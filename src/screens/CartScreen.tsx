import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { createOrder, getStatusUrl } from "../api";
import { useCart } from "../context/CartContext";

type CompletedOrder = {
  orderNumber: string;
  token: string;
};

export default function CartScreen() {
  const { cart, totalAmount, addToCart, removeFromCart, deleteFromCart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);

  const handleOrder = async () => {
    if (cart.length === 0) {
      Alert.alert("カートが空です", "商品をカートに追加してください");
      return;
    }
    Alert.alert(
      "注文を確定しますか？",
      `合計 ¥${totalAmount.toLocaleString()} の注文を送信します。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "注文する",
          onPress: async () => {
            setLoading(true);
            try {
              const result = await createOrder(cart);
              clearCart();
              setCompletedOrder(result);
            } catch (e) {
              Alert.alert("エラー", "注文の送信に失敗しました。もう一度お試しください。");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // 注文完了画面
  if (completedOrder) {
    const statusUrl = getStatusUrl(completedOrder.token);
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.completedContainer}>
          <Text style={styles.completedEmoji}>✅</Text>
          <Text style={styles.completedTitle}>ご注文ありがとうございます</Text>
          <View style={styles.orderNumberBox}>
            <Text style={styles.orderNumberLabel}>注文番号</Text>
            <Text style={styles.orderNumber}>{completedOrder.orderNumber}</Text>
          </View>
          <View style={styles.qrContainer}>
            <Text style={styles.qrLabel}>QRコードで準備状況を確認</Text>
            <View style={styles.qrBox}>
              <QRCode value={statusUrl} size={200} />
            </View>
            <Text style={styles.qrUrl} numberOfLines={2}>{statusUrl}</Text>
          </View>
          <TouchableOpacity
            style={styles.newOrderBtn}
            onPress={() => setCompletedOrder(null)}
          >
            <Text style={styles.newOrderBtnText}>新しい注文をする</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyText}>カートは空です</Text>
          <Text style={styles.emptySubText}>メニューから商品を追加してください</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.cartList} contentContainerStyle={{ paddingBottom: 16 }}>
            {cart.map((item) => (
              <View key={item.dishId} style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.dishName}</Text>
                  <Text style={styles.cartItemPrice}>
                    ¥{parseInt(item.price).toLocaleString()} × {item.quantity} ={" "}
                    ¥{(parseInt(item.price) * item.quantity).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.cartItemActions}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => removeFromCart(item.dishId)}
                  >
                    <Text style={styles.qtyBtnText}>－</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() =>
                      addToCart({ dishId: item.dishId, dishName: item.dishName, price: item.price })
                    }
                  >
                    <Text style={styles.qtyBtnText}>＋</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteFromCart(item.dishId)}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>合計</Text>
              <Text style={styles.totalAmount}>¥{totalAmount.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={[styles.orderBtn, loading && styles.orderBtnDisabled]}
              onPress={handleOrder}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.orderBtnText}>注文を確定する</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },

  // 空カート
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 8 },
  emptySubText: { fontSize: 14, color: "#888", textAlign: "center" },

  // カートリスト
  cartList: { flex: 1, padding: 16 },
  cartItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cartItemInfo: { flex: 1, marginRight: 12 },
  cartItemName: { fontSize: 15, fontWeight: "bold", color: "#1a1a1a", marginBottom: 4 },
  cartItemPrice: { fontSize: 13, color: "#e91e8c", fontWeight: "600" },
  cartItemActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 16, fontWeight: "bold", color: "#333" },
  qtyText: { fontSize: 16, fontWeight: "bold", minWidth: 24, textAlign: "center" },
  deleteBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  deleteBtnText: { fontSize: 16 },

  // フッター
  footer: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 16, color: "#555" },
  totalAmount: { fontSize: 22, fontWeight: "bold", color: "#1a1a1a" },
  orderBtn: {
    backgroundColor: "#e91e8c",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  orderBtnDisabled: { opacity: 0.6 },
  orderBtnText: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  // 注文完了
  completedContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  completedEmoji: { fontSize: 64, marginBottom: 16 },
  completedTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a1a", marginBottom: 24 },
  orderNumberBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#e91e8c",
  },
  orderNumberLabel: { fontSize: 13, color: "#888", marginBottom: 6 },
  orderNumber: { fontSize: 40, fontWeight: "bold", color: "#e91e8c", letterSpacing: 4 },
  qrContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
  },
  qrLabel: { fontSize: 14, color: "#555", marginBottom: 16 },
  qrBox: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  qrUrl: { fontSize: 10, color: "#aaa", marginTop: 10, textAlign: "center" },
  newOrderBtn: {
    backgroundColor: "#e91e8c",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  newOrderBtnText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
