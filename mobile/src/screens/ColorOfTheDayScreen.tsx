import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColorOfTheDay, getColorOfTheDayHistory } from '../api/palettes';
import { ColorData } from '../api/colors';
import ColorDetailScreen from './ColorDetailScreen';

const { width: W } = Dimensions.get('window');

function getTextColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

function useCountdown() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      return Math.floor((midnight.getTime() - now.getTime()) / 1000);
    };
    setSecs(calc());
    const id = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

type CotdColor = ColorData & { cotd_date: string };

export default function ColorOfTheDayScreen() {
  const insets = useSafeAreaInsets();
  const countdown = useCountdown();
  const [cotd, setCotd] = useState<CotdColor | null>(null);
  const [history, setHistory] = useState<CotdColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailHexId, setDetailHexId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getColorOfTheDay(), getColorOfTheDayHistory()])
      .then(([today, hist]) => {
        setCotd(today);
        // Drop today's entry from the history strip (it's the hero already)
        setHistory(hist.data.filter(h => h.hex_id !== today.hex_id));
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cotd) {
    return <View style={styles.loader}><ActivityIndicator color="#fff" size="large" /></View>;
  }

  const bg = `#${cotd.hex_code}`;
  const fg = getTextColor(cotd.r, cotd.g, cotd.b);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Badge */}
      <View style={[styles.badge, { top: insets.top + 20 }]}>
        <Text style={[styles.badgeText, { color: fg, borderColor: fg }]}>
          ✦ COLOR OF THE DAY
        </Text>
      </View>

      {/* Main color info */}
      <View style={styles.center}>
        <TouchableOpacity onPress={() => setDetailHexId(cotd.hex_id)} activeOpacity={0.7}>
          <Text style={[styles.hex, { color: fg }]}>#{cotd.hex_code}</Text>
        </TouchableOpacity>
        {cotd.custom_name && (
          <Text style={[styles.name, { color: fg }]}>"{cotd.custom_name}"</Text>
        )}
        <Text style={[styles.rgb, { color: fg }]}>
          rgb({cotd.r}, {cotd.g}, {cotd.b})
        </Text>
        <Text style={[styles.hsl, { color: fg }]}>
          hsl({cotd.h}°, {cotd.s}%, {cotd.l}%)
        </Text>

        {cotd.discovered_by && (
          <View style={[styles.discoverer, { borderColor: `${fg}44` }]}>
            <Text style={[styles.discovererLabel, { color: fg }]}>discovered by</Text>
            <Text style={[styles.discovererName, { color: fg }]}>
              @{cotd.discovered_by.username}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom: history strip + countdown */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {history.length > 0 && (
          <View style={styles.historyBlock}>
            <Text style={[styles.historyLabel, { color: fg }]}>Past colors</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyRow}
            >
              {history.map(h => (
                <TouchableOpacity
                  key={h.hex_id}
                  onPress={() => setDetailHexId(h.hex_id)}
                  activeOpacity={0.7}
                  style={styles.historyItem}
                >
                  <View style={[styles.historySwatch, {
                    backgroundColor: `#${h.hex_code}`,
                    borderColor: `${fg}33`,
                  }]} />
                  <Text style={[styles.historyDate, { color: fg }]}>
                    {h.cotd_date.split('-').slice(1).join('/')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.countdown}>
          <Text style={[styles.countdownLabel, { color: fg }]}>Next color in</Text>
          <Text style={[styles.countdownTimer, { color: fg }]}>{countdown}</Text>
        </View>
      </View>

      {/* Color detail modal */}
      <Modal visible={detailHexId !== null} animationType="slide" presentationStyle="pageSheet">
        {detailHexId !== null && (
          <ColorDetailScreen hexId={detailHexId} onClose={() => setDetailHexId(null)} />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  badge: { position: 'absolute', alignSelf: 'center' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 3, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  hex: { fontSize: 52, fontWeight: '900', letterSpacing: 2 },
  name: { fontSize: 20, fontWeight: '700', opacity: 0.85 },
  rgb: { fontSize: 15, opacity: 0.7, marginTop: 4 },
  hsl: { fontSize: 13, opacity: 0.55 },
  discoverer: { marginTop: 24, borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center' },
  discovererLabel: { fontSize: 11, opacity: 0.6 },
  discovererName: { fontSize: 15, fontWeight: '700' },
  bottom: { paddingHorizontal: 16 },
  historyBlock: { marginBottom: 20 },
  historyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.6, marginBottom: 8, marginLeft: 4 },
  historyRow: { gap: 10, paddingHorizontal: 4 },
  historyItem: { alignItems: 'center', gap: 4 },
  historySwatch: { width: 44, height: 44, borderRadius: 12, borderWidth: 1 },
  historyDate: { fontSize: 9, opacity: 0.6, fontVariant: ['tabular-nums'] },
  countdown: { alignItems: 'center' },
  countdownLabel: { fontSize: 11, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' },
  countdownTimer: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 2 },
});
