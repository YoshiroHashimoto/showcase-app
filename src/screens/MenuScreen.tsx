import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Category, Dish, fetchActiveDishes, fetchCategories } from "../api";
import { useCart } from "../context/CartContext";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export default function MenuScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToCart, cart } = useCart();

  useEffect(() => {
    (async () => {
      try {
        const [cats, dishs] = await Promise.all([fetchCategories(), fetchActiveDishes()]);
        setCategories(cats);
        setDishes(dishs);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);
      } catch (e) {
        console.error("Failed to load menu:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDishes = dishes.filter((d) => d.categoryId === selectedCategoryId);

  const getCartQty = (dishId: number) =>
    cart.find((i) => i.dishId === dishId)?.quantity ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#e91e8c" />
        <Text style={styles.loadingText}>メニューを読み込み中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* カテゴリタブ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryBarContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryTab,
              selectedCategoryId === cat.id && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategoryId(cat.id)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategoryId === cat.id && styles.categoryTabTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 商品グリッド */}
      {filteredDishes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>このカテゴリに商品がありません</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDishes}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => {
            const qty = getCartQty(item.id);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  addToCart({ dishId: item.id, dishName: item.name, price: item.price })
                }
                activeOpacity={0.8}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Text style={{ fontSize: 36 }}>🎂</Text>
                  </View>
                )}
                {qty > 0 && (
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>{qty}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.cardPrice}>¥{parseInt(item.price).toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  emptyText: { color: "#888", fontSize: 15 },
  categoryBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    maxHeight: 52,
  },
  categoryBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  categoryTabActive: {
    backgroundColor: "#e91e8c",
  },
  categoryTabText: { fontSize: 14, color: "#555", fontWeight: "500" },
  categoryTabTextActive: { color: "#fff", fontWeight: "bold" },
  grid: { padding: 12 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: CARD_WIDTH * 0.75,
  },
  cardImagePlaceholder: {
    backgroundColor: "#fce4ec",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#e91e8c",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  qtyBadgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  cardBody: { padding: 10 },
  cardName: { fontSize: 13, fontWeight: "bold", color: "#1a1a1a", marginBottom: 2 },
  cardDesc: { fontSize: 11, color: "#888", marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: "bold", color: "#e91e8c" },
});
