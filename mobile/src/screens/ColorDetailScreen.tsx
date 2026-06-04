import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColor, ColorData } from '../api/colors';
import { getPalettes, addColorToPalette, Palette } from '../api/palettes';

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
  const [palettePickerOpen, setPalettePickerOpen] = useState(false);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    getColor(hexId).then(setData).catch(console.warn);
  }, [hexId]);

  const openPalettePicker = async () => {
    try {
      const ps = await getPalettes();
      setPalettes(ps);
      setPalettePickerOpen(true);
    } catch (e) {
      Alert.alert('Error', 'Could not load palettes');
    }
  };

  const handleAddToPalette = async (paletteId: string) => {
    if (addingTo || added.has(paletteId)) return;
    setAddingTo(paletteId);
    try {
      await addColorToPalette(paletteId, hexId);
      setAdded(prev => new Set([...prev, paletteId]));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add color');
    } finally {
      setAddingTo(null);
    }
  };

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
      {/* Hero */}
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

        {/* Add to palette */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.addPaletteBtn, { borderColor: bg }]} onPress={openPalettePicker}>
            <Text style={styles.addPaletteBtnIcon}>▦</Text>
            <Text style={styles.addPaletteBtnText}>Add to palette</Text>
          </TouchableOpacity>
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

      {/* Palette picker modal */}
      <Modal visible={palettePickerOpen} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Add #{data.hex_code} to...</Text>

            {palettes.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>No palettes yet — create one in the Palettes tab</Text>
              </View>
            ) : (
              <FlatList
                data={palettes}
                keyExtractor={p => p.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item: p }) => {
                  const isAdded = added.has(p.id);
                  const isLoading = addingTo === p.id;
                  return (
                    <TouchableOpacity
                      style={[styles.pickerRow, isAdded && styles.pickerRowDone]}
                      onPress={() => handleAddToPalette(p.id)}
                      disabled={isAdded || isLoading}
                    >
                      {/* Mini swatch strip */}
                      <View style={styles.pickerStrip}>
                        {(p.preview?.length ? p.preview : ['333333']).map((hex, i) => (
                          <View key={i} style={[styles.pickerStripSeg, { backgroundColor: `#${hex}` }]} />
                        ))}
                      </View>
                      <View style={styles.pickerMeta}>
                        <Text style={styles.pickerName}>{p.name}</Text>
                        <Text style={styles.pickerCount}>{p.colors_count}/12</Text>
                      </View>
                      <Text style={styles.pickerAction}>
                        {isLoading ? '…' : isAdded ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => { setPalettePickerOpen(false); setAdded(new Set()); }}
            >
              <Text style={styles.pickerCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  addPaletteBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#333' },
  addPaletteBtnIcon: { color: '#fff', fontSize: 18 },
  addPaletteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchItem: { alignItems: 'center', width: (W - 40 - 70) / 8, minWidth: 56 },
  swatch: { width: 48, height: 48, borderRadius: 10, marginBottom: 4 },
  swatchLabel: { color: '#555', fontSize: 8 },
  // Palette picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  pickerHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  pickerEmpty: { padding: 24, alignItems: 'center' },
  pickerEmptyText: { color: '#555', textAlign: 'center', lineHeight: 20 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  pickerRowDone: { opacity: 0.5 },
  pickerStrip: { flexDirection: 'row', width: 40, height: 40, borderRadius: 8, overflow: 'hidden' },
  pickerStripSeg: { flex: 1, height: '100%' },
  pickerMeta: { flex: 1 },
  pickerName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  pickerCount: { color: '#555', fontSize: 12, marginTop: 2 },
  pickerAction: { color: '#fff', fontSize: 22, fontWeight: '700', width: 28, textAlign: 'center' },
  pickerClose: { marginTop: 16, padding: 14, backgroundColor: '#1a1a1a', borderRadius: 12, alignItems: 'center' },
  pickerCloseText: { color: '#fff', fontWeight: '700' },
});
