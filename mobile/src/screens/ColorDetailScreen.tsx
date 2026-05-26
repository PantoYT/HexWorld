import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColor, ColorData } from '../api/colors';

const { width: W } = Dimensions.get('window');

function getTextColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
    ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
}

function rgbToCmyk(r: number, g: number, b: number) {
  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const k = 1 - Math.max(r1, g1, b1);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r1 - k) / (1 - k)) * 100),
    m: Math.round(((1 - g1 - k) / (1 - k)) * 100),
    y: Math.round(((1 - b1 - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

interface Props {
  hexId: number;
  onClose: () => void;
}

export default function ColorDetailScreen({ hexId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<(ColorData & { similar: ColorData[] }) | null>(null);

  useEffect(() => {
    getColor(hexId).then(setData).catch(console.warn);
  }, [hexId]);

  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const bg = `#${data.hex_code}`;
  const fg = getTextColor(data.r, data.g, data.b);
  const cmyk = rgbToCmyk(data.r, data.g, data.b);

  return (
    <View style={styles.container}>
      {/* Hero swatch */}
      <View style={[styles.hero, { backgroundColor: bg, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={[styles.closeText, { color: fg }]}>✕</Text>
        </TouchableOpacity>

        {data.custom_name && (
          <Text style={[styles.customName, { color: fg }]}>"{data.custom_name}"</Text>
        )}
        <Text style={[styles.hexHero, { color: fg }]}>#{data.hex_code}</Text>

        {data.discovered_by && (
          <Text style={[styles.discovererHero, { color: fg }]}>
            discovered by @{data.discovered_by.username}
          </Text>
        )}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Color values */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color Values</Text>
          <View style={styles.valueGrid}>
            <ColorValue label="HEX" value={`#${data.hex_code}`} />
            <ColorValue label="RGB" value={`${data.r}, ${data.g}, ${data.b}`} />
            <ColorValue label="HSL" value={`${data.h}°  ${data.s}%  ${data.l}%`} />
            <ColorValue label="CMYK" value={`${cmyk.c}  ${cmyk.m}  ${cmyk.y}  ${cmyk.k}`} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <Stat icon="♥" value={data.likes_count} label="likes" />
            <Stat icon="💬" value={data.comments_count} label="comments" />
            <Stat icon="👁" value={data.views_count} label="views" />
          </View>
        </View>

        {/* Similar colors */}
        {data.similar?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Similar Colors</Text>
            <View style={styles.swatchGrid}>
              {data.similar.slice(0, 8).map((c) => (
                <View key={c.hex_id} style={styles.swatchItem}>
                  <View style={[styles.swatch, { backgroundColor: `#${c.hex_code}` }]} />
                  <Text style={styles.swatchLabel}>#{c.hex_code}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

function ColorValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  loading: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  hero: { height: 220, justifyContent: 'flex-end', padding: 20 },
  closeBtn: { position: 'absolute', top: 52, right: 20, padding: 8 },
  closeText: { fontSize: 18, fontWeight: '700' },
  customName: { fontSize: 16, fontWeight: '600', opacity: 0.8, marginBottom: 4 },
  hexHero: { fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  discovererHero: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  body: { flex: 1 },
  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' },
  valueGrid: { gap: 10 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueLabel: { color: '#555', fontSize: 13, fontWeight: '600', width: 52 },
  valueText: { color: '#fff', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statsRow: { flexDirection: 'row', gap: 32 },
  statItem: { alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 20 },
  statNum: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#555', fontSize: 11 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchItem: { alignItems: 'center', width: (W - 40 - 70) / 8, minWidth: 56 },
  swatch: { width: 48, height: 48, borderRadius: 10, marginBottom: 4 },
  swatchLabel: { color: '#555', fontSize: 8, fontVariant: ['tabular-nums'] },
});
