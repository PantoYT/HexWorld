import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Animated, PanResponder, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorData, feedNext, likeColor, unlikeColor, discoverColor, markViewed } from '../api/colors';
import CommentSheet from '../components/CommentSheet';
import LikeAnimation from '../components/LikeAnimation';
import ColorDetailScreen from './ColorDetailScreen';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_H * 0.25;
const VIEW_SECONDS = 2000;

function getTextColor(r: number, g: number, b: number): string {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
    ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [stack, setStack] = useState<ColorData[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [discoverModalVisible, setDiscoverModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [pendingDiscover, setPendingDiscover] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [likeFlash, setLikeFlash] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const current = stack[index];

  const loadNext = useCallback(async () => {
    try {
      const color = await feedNext();
      setStack(prev => [...prev, color]);
    } catch (e) { console.warn('Feed error', e); }
  }, []);

  useEffect(() => {
    const toLoad = 3 - (stack.length - index);
    if (toLoad > 0) for (let i = 0; i < toLoad; i++) loadNext();
    if (stack.length > 0) setLoading(false);
  }, [index, stack.length]);

  useEffect(() => {
    if (!current) return;
    if (viewTimer.current) clearTimeout(viewTimer.current);
    setPendingDiscover(false);
    viewTimer.current = setTimeout(() => {
      markViewed(current.hex_id).catch(() => {});
      if (!current.discovered_by) {
        setPendingDiscover(true);
        setDiscoverModalVisible(true);
      }
    }, VIEW_SECONDS);
    return () => { if (viewTimer.current) clearTimeout(viewTimer.current); };
  }, [current?.hex_id]);

  const goNext = useCallback(() => {
    Animated.timing(translateY, { toValue: -SCREEN_H, duration: 250, useNativeDriver: true }).start(() => {
      setIndex(i => i + 1);
      translateY.setValue(0);
    });
  }, []);

  const goPrev = useCallback(() => {
    if (index === 0) return;
    Animated.timing(translateY, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }).start(() => {
      setIndex(i => i - 1);
      translateY.setValue(0);
    });
  }, [index]);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => translateY.setValue(g.dy),
    onPanResponderRelease: (_, g) => {
      if (g.dy < -SWIPE_THRESHOLD) goNext();
      else if (g.dy > SWIPE_THRESHOLD) goPrev();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleLike();
    }
    lastTap.current = now;
  };

  const handleLike = async () => {
    if (!current) return;
    if (!current.is_liked) {
      setLikeFlash(false);
      setTimeout(() => setLikeFlash(true), 10);
    }
    try {
      if (current.is_liked) {
        await unlikeColor(current.hex_id);
        setStack(prev => prev.map((c, i) => i === index ? { ...c, is_liked: false, likes_count: c.likes_count - 1 } : c));
      } else {
        await likeColor(current.hex_id);
        setStack(prev => prev.map((c, i) => i === index ? { ...c, is_liked: true, likes_count: c.likes_count + 1 } : c));
      }
    } catch (e) { console.warn(e); }
  };

  const handleDiscover = async (skipName = false) => {
    if (!current) return;
    const name = skipName ? undefined : customName.trim() || undefined;
    try {
      const result = await discoverColor(current.hex_id, name);
      setStack(prev => prev.map((c, i) => i === index ? {
        ...c,
        custom_name: result.color.custom_name,
        discovered_by: result.color.discovered_by,
        discovered_at: result.color.discovered_at,
      } : c));
      setDiscoverModalVisible(false);
      setCustomName('');
      setPendingDiscover(false);
      if (result.is_first_discoverer) {
        Alert.alert(
          '🎉 First Discovery!',
          `You discovered #${current.hex_code}${result.color.custom_name ? `\n"${result.color.custom_name}"` : ''}`,
          [{ text: 'Amazing!' }]
        );
      }
    } catch (e) {
      console.warn(e);
      setDiscoverModalVisible(false);
      setPendingDiscover(false);
    }
  };

  if (loading || !current) {
    return <View style={styles.loader}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const bg = `#${current.hex_code}`;
  const fg = getTextColor(current.r, current.g, current.b);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.card, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={handleDoubleTap}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
        </TouchableOpacity>

        {/* Top bar */}
        <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="none">
          <Text style={[styles.appName, { color: fg }]}>HexWorld</Text>
        </View>

        {/* Discoverer badge */}
        {current.discovered_by && (
          <View style={[styles.discovererBadge, { top: insets.top + 50 }]} pointerEvents="none">
            <Text style={[styles.discovererText, { color: fg }]}>@{current.discovered_by.username}</Text>
            {current.custom_name && (
              <Text style={[styles.customName, { color: fg }]}>"{current.custom_name}"</Text>
            )}
          </View>
        )}

        {/* Like animation */}
        <LikeAnimation visible={likeFlash} />

        {/* Right actions */}
        <View style={[styles.actions, { bottom: insets.bottom + 100 }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Text style={[styles.actionIcon, current.is_liked && styles.liked]}>♥</Text>
            <Text style={[styles.actionLabel, { color: fg }]}>{current.likes_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsOpen(true)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={[styles.actionLabel, { color: fg }]}>{current.comments_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setDetailOpen(true)}>
            <Text style={styles.actionIcon}>ℹ</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom info */}
        <View style={[styles.bottomInfo, { bottom: insets.bottom + 40 }]} pointerEvents="none">
          <Text style={[styles.hexCode, { color: fg }]}>#{current.hex_code}</Text>
          <Text style={[styles.rgbLabel, { color: fg }]}>
            rgb({current.r}, {current.g}, {current.b})  ·  hsl({current.h}°, {current.s}%, {current.l}%)
          </Text>
        </View>

        {index === 0 && stack.length <= 3 && (
          <View style={styles.swipeHint} pointerEvents="none">
            <Text style={[styles.swipeHintText, { color: fg }]}>swipe to explore ↑  ·  double tap to like</Text>
          </View>
        )}
      </Animated.View>

      {/* Comment sheet */}
      <CommentSheet
        hexId={current.hex_id}
        hexCode={current.hex_code}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCountChange={(delta) =>
          setStack(prev => prev.map((c, i) => i === index ? { ...c, comments_count: c.comments_count + delta } : c))
        }
      />

      {/* Color detail modal */}
      <Modal visible={detailOpen} animationType="slide" presentationStyle="pageSheet">
        <ColorDetailScreen hexId={current.hex_id} onClose={() => setDetailOpen(false)} />
      </Modal>

      {/* Discover modal */}
      <Modal visible={discoverModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🎉 You discovered #{current.hex_code}!</Text>
            <Text style={styles.modalSubtitle}>Give it a name (optional)</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="e.g. Ocean Mist"
              placeholderTextColor="#999"
              maxLength={32}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnSkip} onPress={() => handleDiscover(true)}>
                <Text style={styles.modalBtnSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSave, { backgroundColor: bg }]} onPress={() => handleDiscover(false)}>
                <Text style={[styles.modalBtnSaveText, { color: fg }]}>Claim it!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  card: { flex: 1, width: SCREEN_W, height: SCREEN_H },
  topBar: { position: 'absolute', left: 16, zIndex: 10 },
  appName: { fontSize: 18, fontWeight: '700', letterSpacing: 2, opacity: 0.7 },
  discovererBadge: { position: 'absolute', left: 16, zIndex: 10 },
  discovererText: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  customName: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  actions: { position: 'absolute', right: 16, zIndex: 10, alignItems: 'center', gap: 24 },
  actionBtn: { alignItems: 'center' },
  actionIcon: { fontSize: 28 },
  liked: { color: '#ff3b30' },
  actionLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  bottomInfo: { position: 'absolute', left: 16, zIndex: 10 },
  hexCode: { fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  rgbLabel: { fontSize: 12, opacity: 0.65, marginTop: 4 },
  swipeHint: { position: 'absolute', bottom: 12, width: '100%', alignItems: 'center' },
  swipeHintText: { fontSize: 12, opacity: 0.45 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, color: '#111' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  nameInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtnSkip: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  modalBtnSkipText: { color: '#666', fontWeight: '600' },
  modalBtnSave: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnSaveText: { fontWeight: '800', fontSize: 16 },
});
