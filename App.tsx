import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  Dimensions,
  TextInput,
  RefreshControl,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import QRCode from 'react-native-qrcode-svg';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchAllDishes,
  fetchActiveNews,
  createOrder,
  registerPushToken,
  Dish,
  NewsItem,
  OrderItem,
} from './src/api';

// スプラッシュ画面を自動非表示にしない
SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── Notification Setup ──────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C9A84C',
      });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'fresh_cake' | 'birthday_cake' | 'baked_goods' | 'gift';
type CartItem = Dish & { quantity: number };

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'fresh_cake', label: '生ケーキ' },
  { value: 'birthday_cake', label: '誕生日ケーキ' },
  { value: 'baked_goods', label: '焼き菓子' },
  { value: 'gift', label: 'ギフト' },
];

const GOLD = '#C9A84C';
const BG = '#0a0a0a';
const CARD_BG = '#141414';
const BORDER = '#2a2a2a';
const TEXT = '#f0ede8';
const MUTED = '#888';
const PINK = '#e91e8c';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── QtyControl ──────────────────────────────────────────────────────────────
function QtyControl({
  value,
  onDecrement,
  onIncrement,
  minValue = 0,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  minValue?: number;
}) {
  return (
    <View style={styles.qtyRow}>
      <TouchableOpacity
        style={[styles.qtyBtn, value <= minValue && styles.qtyBtnDisabled]}
        onPress={onDecrement}
        disabled={value <= minValue}
        activeOpacity={0.7}
      >
        <Text style={styles.qtyBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.qtyNum}>{value}</Text>
      <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement} activeOpacity={0.7}>
        <Text style={styles.qtyBtnText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── DishCard ─────────────────────────────────────────────────────────────────
// カートバッジ数を受け取り、商品に追加済みの場合は左上に数量バッジを表示
function DishCard({
  dish,
  onAddToCart,
  onPress,
  cartQty,
}: {
  dish: Dish;
  onAddToCart: (dish: Dish) => void;
  onPress: (dish: Dish) => void;
  cartQty: number;
}) {
  const categoryLabel = CATEGORIES.find(c => c.value === dish.category)?.label ?? dish.category;
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(dish)} activeOpacity={0.92}>
      {dish.imageUrl ? (
        <Image source={{ uri: dish.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ color: MUTED, fontSize: 32 }}>🎂</Text>
        </View>
      )}
      {/* カテゴリバッジ (右上) */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>{categoryLabel.toUpperCase()}</Text>
      </View>
      {/* カート数量バッジ (左上) */}
      {cartQty > 0 && (
        <View style={styles.cartQtyBadge}>
          <Text style={styles.cartQtyBadgeText}>{cartQty}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{dish.name}</Text>
        <Text style={styles.cardPrice}>¥{dish.price.toLocaleString()}</Text>
        {dish.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{dish.description}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={(e) => { e.stopPropagation?.(); onAddToCart(dish); }}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ カートへ</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── DishDetailModal ─────────────────────────────────────────────────────────
// 添付1: 全画面モーダル。上半分=商品画像、右上に×ボタン、下半分=黒背景コンテンツ、底部固定=カートに追加ボタン
function DishDetailModal({
  dish,
  onClose,
  onAddToCart,
}: {
  dish: Dish;
  onClose: () => void;
  onAddToCart: (dish: Dish) => void;
}) {
  const IMAGE_H = Math.round(SCREEN_H * 0.45);
  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar style="light" />

        {/* 画像は固定表示 */}
        <View style={{ width: SCREEN_W, height: IMAGE_H, backgroundColor: '#1a1a1a' }}>
          {dish.imageUrl ? (
            <Image
              source={{ uri: dish.imageUrl }}
              style={{ width: SCREEN_W, height: IMAGE_H }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: SCREEN_W, height: IMAGE_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 72 }}>🎂</Text>
            </View>
          )}
        </View>

        {/* 右上 × ボタン - 画像の上に重ねる */}
        <TouchableOpacity
          style={styles.detailCloseBtn}
          onPress={onClose}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.detailCloseBtnText}>✕</Text>
        </TouchableOpacity>

        {/* テキストエリア: flex:1で残り高さを占有し、カートボタン分の高さをパディングで確保 */}
        <ScrollView
          style={{ flex: 1, backgroundColor: BG }}
          contentContainerStyle={{ padding: 24, paddingBottom: 112 }}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          alwaysBounceVertical={false}
          overScrollMode="always"
        >
          <Text style={styles.detailName}>{dish.name}</Text>
          <View style={styles.detailDivider} />
          <Text style={styles.detailPrice}>¥{dish.price.toLocaleString()}</Text>
          {dish.description ? (
            <Text style={styles.detailDesc}>{dish.description}</Text>
          ) : null}
        </ScrollView>

        {/* 下部絶対固定: カートに追加ボタン */}
        <View style={[styles.detailFooter, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
          <TouchableOpacity
            style={styles.detailAddBtn}
            onPress={() => { onAddToCart(dish); onClose(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.detailAddBtnText}>カートに追加</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── CartModal (注文リストモーダル) ───────────────────────────────────────────
// 添付2: 下から出てくるシート。商品リスト+ロウソク+備考+合計+注文するボタン
function CartModal({
  visible,
  cart,
  onClose,
  onUpdateQty,
  onOrder,
  ordering,
  candleLarge,
  candleSmall,
  notes,
  onCandleLargeChange,
  onCandleSmallChange,
  onNotesChange,
}: {
  visible: boolean;
  cart: CartItem[];
  onClose: () => void;
  onUpdateQty: (id: number, delta: number) => void;
  onOrder: () => void;
  ordering: boolean;
  candleLarge: number;
  candleSmall: number;
  notes: string;
  onCandleLargeChange: (v: number) => void;
  onCandleSmallChange: (v: number) => void;
  onNotesChange: (v: string) => void;
}) {
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '92%', flex: 0 }]}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>注文リスト</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: MUTED, fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexGrow: 1, flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            {/* 商品リスト */}
            {cart.length === 0 ? (
              <Text style={{ color: MUTED, textAlign: 'center', marginTop: 40, marginBottom: 24 }}>
                カートは空です
              </Text>
            ) : (
              cart.map(item => (
                <View key={item.id} style={styles.cartRow}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.cartThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cartThumb, styles.cartThumbPlaceholder]}>
                      <Text style={{ fontSize: 20 }}>🎂</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cartItemPrice}>¥{item.price.toLocaleString()}</Text>
                  </View>
                  <QtyControl
                    value={item.quantity}
                    onDecrement={() => onUpdateQty(item.id, -1)}
                    onIncrement={() => onUpdateQty(item.id, 1)}
                    minValue={0}
                  />
                </View>
              ))
            )}

            {/* 区切り線 */}
            <View style={styles.divider} />

            {/* ロウソクセクション */}
            <View style={styles.candleSection}>
              <View style={styles.candleRow}>
                <Text style={styles.candleLabel}>ロウソク　大</Text>
                <QtyControl
                  value={candleLarge}
                  onDecrement={() => onCandleLargeChange(Math.max(0, candleLarge - 1))}
                  onIncrement={() => onCandleLargeChange(candleLarge + 1)}
                />
              </View>
              <View style={styles.candleRow}>
                <Text style={styles.candleLabel}>ロウソク　小</Text>
                <QtyControl
                  value={candleSmall}
                  onDecrement={() => onCandleSmallChange(Math.max(0, candleSmall - 1))}
                  onIncrement={() => onCandleSmallChange(candleSmall + 1)}
                />
              </View>
            </View>

            {/* 備考欄 */}
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>備考（メッセージプレートは20文字以内）</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={onNotesChange}
                placeholder="メッセージプレートは20文字以内"
                placeholderTextColor={MUTED}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* フッター: 合計 + 注文するボタン */}
          <View style={styles.cartFooter}>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>合計</Text>
              <Text style={styles.cartTotalAmount}>¥{total.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={[styles.orderBtn, (cart.length === 0 || ordering) && { opacity: 0.5 }]}
              onPress={onOrder}
              disabled={cart.length === 0 || ordering}
              activeOpacity={0.8}
            >
              {ordering ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.orderBtnText}>注文する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── OrderCompleteModal ───────────────────────────────────────────────────────
function OrderCompleteModal({
  visible,
  orderNo,
  qrToken,
  onClose,
}: {
  visible: boolean;
  orderNo: string;
  qrToken: string;
  onClose: () => void;
}) {
  const qrUrl = `https://cakemanage-wwq7fcan.manus.space/status?token=${qrToken}`;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { alignItems: 'center', paddingVertical: 36, backgroundColor: '#fff', borderRadius: 20 }]}>
          <Text style={{ fontSize: 16, color: PINK, fontWeight: '700', letterSpacing: 2, marginBottom: 6 }}>✿ 注文完了 ✿</Text>
          <Text style={{ fontSize: 18, color: '#222', fontWeight: '600', marginBottom: 4 }}>ご注文ありがとうございます</Text>
          <Text style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>注文 No.</Text>
          <View style={[styles.orderNoBox, { borderColor: PINK, borderWidth: 1.5, backgroundColor: '#fff', marginBottom: 20 }]}>
            <Text style={[styles.orderNoText, { color: PINK, fontSize: 48 }]}>{orderNo}</Text>
          </View>
          <View style={[styles.qrBox, { backgroundColor: '#fff', borderColor: '#ddd' }]}>
            <QRCode value={qrUrl} size={180} />
          </View>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>QRコードを読み取り{`\n`}準備状況をご確認ください</Text>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: PINK, borderRadius: 32, paddingVertical: 14, paddingHorizontal: 48 }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeBtnText, { color: '#fff', fontSize: 18, fontWeight: '600' }]}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── NewsModal ────────────────────────────────────────────────────────────────
function NewsModal({ news, onClose }: { news: NewsItem; onClose: () => void }) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>お知らせ</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: MUTED, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {news.imageUrl ? (
              <Image source={{ uri: news.imageUrl }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 16 }} resizeMode="cover" />
            ) : null}
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>{news.title}</Text>
            <Text style={{ color: MUTED, fontSize: 14, lineHeight: 22 }}>{news.body}</Text>
          </ScrollView>
          <TouchableOpacity style={[styles.closeBtn, { marginTop: 16 }]} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('fresh_cake');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartVisible, setCartVisible] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderComplete, setOrderComplete] = useState<{ orderNo: string; qrToken: string } | null>(null);
  const [newsToShow, setNewsToShow] = useState<NewsItem | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugToken, setDebugToken] = useState('');
  const [candleLarge, setCandleLarge] = useState(0);
  const [candleSmall, setCandleSmall] = useState(0);
  const [notes, setNotes] = useState('');

  const appState = useRef(AppState.currentState);
  const seenNewsIds = useRef<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const loadDishes = useCallback(async () => {
    try {
      const data = await fetchAllDishes();
      setDishes(data);
    } catch (e) {
      console.error('Failed to load dishes', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkNews = useCallback(async () => {
    try {
      const newsList = await fetchActiveNews();
      const unseen = newsList.find(n => !seenNewsIds.current.has(n.id));
      if (unseen) {
        seenNewsIds.current.add(unseen.id);
        setNewsToShow(unseen);
      }
    } catch {}
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadDishes(), checkNews()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadDishes, checkNews]);

  useEffect(() => {
    async function prepare() {
      try {
        await loadDishes();
        await checkNews();
        registerForPushNotificationsAsync().then(token => {
          if (token) registerPushToken(token, Platform.OS).catch(() => {});
        });
      } catch (e) {
        console.warn('Prepare error:', e);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    prepare();

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        loadDishes();
        checkNews();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [loadDishes, checkNews]);

  const filteredDishes = dishes.filter(d => d.category === activeCategory && d.isActive === 1);

  const addToCart = (dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === dish.id);
      if (existing) return prev.map(i => i.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...dish, quantity: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i);
      return updated.filter(i => i.quantity > 0);
    });
  };

  const handleOrder = async () => {
    if (cart.length === 0) return;
    setOrdering(true);
    try {
      const items: OrderItem[] = cart.map(i => ({
        dishId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }));
      const result = await createOrder(items, candleLarge, candleSmall, notes);
      setCart([]);
      setCandleLarge(0);
      setCandleSmall(0);
      setNotes('');
      setCartVisible(false);
      setOrderComplete({ orderNo: result.orderNo, qrToken: result.qrToken });
    } catch (e) {
      Alert.alert('エラー', '注文に失敗しました。もう一度お試しください。');
    } finally {
      setOrdering(false);
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  if (!appReady) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header - カートボタンなし */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎂 Showcase</Text>
        <Text style={styles.headerTaxNote}>表示価格は消費税込みです</Text>
      </View>

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.tab, activeCategory === cat.value && styles.tabActive]}
            onPress={() => setActiveCategory(cat.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeCategory === cat.value && styles.tabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dish List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: cartCount > 0 ? 100 : 32, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GOLD}
            colors={[GOLD]}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={GOLD} />
          </View>
        ) : filteredDishes.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ color: MUTED, fontSize: 14 }}>このカテゴリには商品がありません</Text>
          </View>
        ) : (
          filteredDishes.map(dish => {
            const cartItem = cart.find(i => i.id === dish.id);
            return (
              <DishCard
                key={dish.id}
                dish={dish}
                onAddToCart={addToCart}
                onPress={setSelectedDish}
                cartQty={cartItem?.quantity ?? 0}
              />
            );
          })
        )}
      </ScrollView>

      {/* 注文リストバー (添付3): カートに商品がある場合のみ画面下部に表示 */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={() => setCartVisible(true)}
          activeOpacity={0.9}
        >
          <Text style={styles.cartBarText}>🛒　注文リスト（{cartCount}）</Text>
        </TouchableOpacity>
      )}

      {/* Debug Button */}
      <TouchableOpacity
        style={[styles.debugBtn, cartCount > 0 && { bottom: 80 }]}
        onPress={() => setDebugVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.debugBtnText}>通知デバッグ</Text>
      </TouchableOpacity>

      {/* 注文リストモーダル (添付2) */}
      <CartModal
        visible={cartVisible}
        cart={cart}
        onClose={() => setCartVisible(false)}
        onUpdateQty={updateQty}
        onOrder={handleOrder}
        ordering={ordering}
        candleLarge={candleLarge}
        candleSmall={candleSmall}
        notes={notes}
        onCandleLargeChange={setCandleLarge}
        onCandleSmallChange={setCandleSmall}
        onNotesChange={setNotes}
      />

      {/* 注文完了モーダル */}
      {orderComplete && (
        <OrderCompleteModal
          visible
          orderNo={orderComplete.orderNo}
          qrToken={orderComplete.qrToken}
          onClose={() => setOrderComplete(null)}
        />
      )}

      {/* 商品詳細モーダル (添付1) */}
      {selectedDish && (
        <DishDetailModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* お知らせモーダル */}
      {newsToShow && (
        <NewsModal news={newsToShow} onClose={() => setNewsToShow(null)} />
      )}

      {/* Debug Modal */}
      <Modal visible={debugVisible} animationType="fade" transparent onRequestClose={() => setDebugVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingVertical: 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>通知デバッグ</Text>
              <TouchableOpacity onPress={() => setDebugVisible(false)}><Text style={{ color: MUTED, fontSize: 22 }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ color: MUTED, fontSize: 12, marginBottom: 12 }}>Expoプッシュトークンを手動登録</Text>
            <TextInput
              style={styles.debugInput}
              value={debugToken}
              onChangeText={setDebugToken}
              placeholder="ExponentPushToken[...]"
              placeholderTextColor={MUTED}
            />
            <TouchableOpacity
              style={[styles.orderBtn, { marginTop: 12 }]}
              onPress={async () => {
                if (!debugToken.trim()) return;
                try {
                  await registerPushToken(debugToken.trim(), Platform.OS);
                  Alert.alert('成功', 'トークンを登録しました');
                  setDebugVisible(false);
                  setDebugToken('');
                } catch {
                  Alert.alert('エラー', '登録に失敗しました');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.orderBtnText}>登録する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.closeBtn, { marginTop: 8 }]} onPress={() => setDebugVisible(false)} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ─── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { color: GOLD, fontSize: 20, fontWeight: '600', letterSpacing: 1 },
  headerTaxNote: { color: TEXT, fontSize: 13, fontWeight: '400', opacity: 0.85 },

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  tabBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabActive: { borderColor: GOLD, backgroundColor: 'rgba(201,168,76,0.1)' },
  tabText: { color: MUTED, fontSize: 14 },
  tabTextActive: { color: GOLD, fontWeight: '600' },

  // ─── List ─────────────────────────────────────────────────────────────────
  list: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ─── DishCard ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: CARD_BG,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardImage: { width: '100%', height: 220 },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: GOLD,
  },
  categoryBadgeText: { color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  // カート数量バッジ (左上・ピンク丸)
  cartQtyBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: PINK,
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartQtyBadgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cardBody: { padding: 16 },
  cardName: { color: TEXT, fontSize: 20, fontWeight: '600', marginBottom: 4 },
  cardPrice: { color: GOLD, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  cardDesc: { color: MUTED, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  addBtn: {
    backgroundColor: PINK,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: 'flex-end',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ─── 注文リストバー (添付3) ────────────────────────────────────────────────
  cartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: PINK,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  cartBarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ─── Modal共通 ────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },

  // ─── CartModal (注文リストモーダル) ──────────────────────────────────────
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  cartThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#1a1a1a' },
  cartThumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2a2a' },
  cartItemName: { color: TEXT, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  cartItemPrice: { color: GOLD, fontSize: 14, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { borderColor: BORDER, opacity: 0.4 },
  qtyBtnText: { color: TEXT, fontSize: 18, lineHeight: 22 },
  qtyNum: { color: TEXT, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },
  candleSection: { gap: 12, marginBottom: 16 },
  candleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  candleLabel: { color: TEXT, fontSize: 16, fontWeight: '500' },
  notesSection: { marginBottom: 8 },
  notesLabel: { color: MUTED, fontSize: 13, marginBottom: 8 },
  notesInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    color: TEXT,
    fontSize: 14,
    minHeight: 72,
    backgroundColor: '#111',
  },
  cartFooter: {
    marginTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 16,
  },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartTotalLabel: { color: TEXT, fontSize: 16, fontWeight: '500' },
  cartTotalAmount: { color: TEXT, fontSize: 24, fontWeight: '900' },
  orderBtn: {
    backgroundColor: PINK,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  orderBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  // ─── DishDetailModal (添付1) ──────────────────────────────────────────────
  detailCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    backgroundColor: 'rgba(40,40,40,0.85)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  detailCloseBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  detailContent: { padding: 24, paddingBottom: 32 },
  detailName: { color: TEXT, fontSize: 26, fontWeight: '700', marginBottom: 12, lineHeight: 34 },
  detailDivider: { height: 1, backgroundColor: BORDER, marginBottom: 14 },
  detailPrice: { color: GOLD, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  detailDesc: { color: MUTED, fontSize: 15, lineHeight: 26 },
  detailFooter: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  detailAddBtn: {
    backgroundColor: PINK,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  detailAddBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // ─── OrderCompleteModal ───────────────────────────────────────────────────
  orderNoBox: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    width: '100%',
  },
  orderNoText: { color: GOLD, fontSize: 48, fontWeight: '900' },
  qrBox: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    width: '100%',
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  closeBtnText: { color: MUTED, fontSize: 15 },

  // ─── Debug ────────────────────────────────────────────────────────────────
  debugBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  debugBtnText: { color: GOLD, fontSize: 12 },
  debugInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    color: TEXT,
    fontSize: 13,
  },
});
