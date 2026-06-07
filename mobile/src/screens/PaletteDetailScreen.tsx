import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPaletteDetail, removeColorFromPalette, Palette } from '../api/palettes';
import { ColorData } from '../api/colors';
import { exportPalette } from '../utils/paletteExport';

const { width: W } = Dimensions.get('window');
const SWATCH_SIZE = (W - 48) / 4;

function getTextColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

interface Props {
  paletteId: string;
  onClose: () => void;
}

export default function PaletteDetailScreen({ paletteId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [palette, setPalette] = useState<(Palette & { colors: ColorData[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    getPaletteDetail(paletteId)
      .then(p => setPalette(p as any))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [paletteId]);

  const handleRemove = (hexId: number, hexCode: string) => {
    Alert.alert(`Remove #${hexCode}?`, 'It will be removed from this palette.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setRemoving(hexId);
          try {
            await removeColorFromPalette(paletteId, hexId);
            setPalette(prev => prev ? {
              ...prev,
              colors: prev.colors.filter(c => c.hex_id !== hexId),
              colors_count: prev.colors_count - 1,
            } : prev);
          } catch (e) { console.warn(e); }
          finally { setRemoving(null); }
        }
      }
    ]);
  };

  const handleExport = async () => {
    if (!palette || palette.colors.length === 0) {
      Alert.alert('Empty palette', 'Add some colors before exporting.');
      return;
    }
    try {
      await exportPalette(palette);
    } catch (e) { console.warn(e); }
  };

  if (loading || !palette) {
    return <View style={styles.loader}><ActivityIndicator color="#fff" size="large" /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
          <Text style={styles.exportText}>{Platform.OS === 'web' ? 'Export PNG ↓' : 'Share ↑'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Palette hero strip */}
        {palette.colors.length > 0 && (
          <View style={styles.heroStrip}>
            {palette.colors.map(c => (
              <View
                key={c.hex_id}
                style={[styles.heroSegment, {
                  backgroundColor: `#${c.hex_code}`,
                  flex: 1,
                }]}
              />
            ))}
          </View>
        )}

        {/* Palette info */}
        <View style={styles.info}>
          <Text style={styles.paletteName}>{palette.name}</Text>
          {palette.description && (
            <Text style={styles.paletteDesc}>{palette.description}</Text>
          )}
          <Text style={styles.paletteMeta}>
            {palette.colors_count} color{palette.colors_count !== 1 ? 's' : ''}
            {' · '}
            {palette.is_public ? '🌍 public' : '🔒 private'}
          </Text>
        </View>

        {/* Color grid */}
        {palette.colors.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No colors yet</Text>
            <Text style={styles.emptyHint}>
              Open any color's detail screen (ℹ) and tap "Add to palette"
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {palette.colors.map(c => {
              const fg = getTextColor(c.r, c.g, c.b);
              const isRemoving = removing === c.hex_id;
              return (
                <TouchableOpacity
                  key={c.hex_id}
                  style={[styles.swatchCard, { backgroundColor: `#${c.hex_code}` }]}
                  onLongPress={() => handleRemove(c.hex_id, c.hex_code)}
                  activeOpacity={0.85}
                >
                  {isRemoving && (
                    <ActivityIndicator color={fg} size="small" style={StyleSheet.absoluteFill} />
                  )}
                  <View style={styles.swatchInfo}>
                    {c.custom_name && (
                      <Text style={[styles.swatchName, { color: fg }]} numberOfLines={1}>
                        {c.custom_name}
                      </Text>
                    )}
                    <Text style={[styles.swatchHex, { color: fg }]}>#{c.hex_code}</Text>
                    <Text style={[styles.swatchRgb, { color: fg }]}>
                      {c.r} {c.g} {c.b}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.hint}>
          <Text style={styles.hintText}>Long press a color to remove it</Text>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0a' },
  loader:     { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:    { padding: 4 },
  backText:   { color: '#fff', fontSize: 15, fontWeight: '600' },
  exportBtn:  { backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#333' },
  exportText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  heroStrip:  { height: 80, flexDirection: 'row', marginBottom: 0 },
  heroSegment:{ height: '100%' },
  info:       { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  paletteName:{ color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  paletteDesc:{ color: '#888', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  paletteMeta:{ color: '#555', fontSize: 12 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  swatchCard: { width: SWATCH_SIZE, height: SWATCH_SIZE * 1.15, borderRadius: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  swatchInfo: { padding: 8 },
  swatchName: { fontSize: 9, fontWeight: '700', marginBottom: 1 },
  swatchHex:  { fontSize: 11, fontWeight: '900' },
  swatchRgb:  { fontSize: 8, opacity: 0.65, marginTop: 1 },
  empty:      { alignItems: 'center', padding: 48 },
  emptyText:  { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint:  { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  hint:       { paddingVertical: 12, alignItems: 'center' },
  hintText:   { color: '#333', fontSize: 12 },
});
