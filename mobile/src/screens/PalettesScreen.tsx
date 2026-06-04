import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, TextInput, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPalettes, createPalette, deletePalette, Palette } from '../api/palettes';

const { width: W } = Dimensions.get('window');

export default function PalettesScreen() {
  const insets = useSafeAreaInsets();
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getPalettes();
      setPalettes(data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const p = await createPalette(newName.trim(), newDesc.trim() || undefined);
      setPalettes(prev => [p, ...prev]);
      setCreating(false);
      setNewName('');
      setNewDesc('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create palette');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deletePalette(id);
            setPalettes(prev => prev.filter(p => p.id !== id));
          } catch (e) { console.warn(e); }
        }
      },
    ]);
  };

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator color="#fff" size="large" /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Palettes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreating(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {palettes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No palettes yet</Text>
          <Text style={styles.emptyHint}>Create your first palette to start curating colors</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setCreating(true)}>
            <Text style={styles.emptyBtnText}>Create palette</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={palettes}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={styles.card}
              onLongPress={() => handleDelete(p.id, p.name)}
              activeOpacity={0.8}
            >
              {/* Swatch strip */}
              <View style={styles.swatchStrip}>
                {p.preview.length > 0
                  ? p.preview.map((hex, i) => (
                    <View
                      key={i}
                      style={[styles.swatchSegment, {
                        backgroundColor: `#${hex}`,
                        flex: 1,
                        borderTopLeftRadius: i === 0 ? 10 : 0,
                        borderBottomLeftRadius: i === 0 ? 10 : 0,
                        borderTopRightRadius: i === p.preview.length - 1 ? 10 : 0,
                        borderBottomRightRadius: i === p.preview.length - 1 ? 10 : 0,
                      }]}
                    />
                  ))
                  : <View style={[styles.swatchSegment, { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10 }]} />
                }
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{p.name}</Text>
                {p.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>{p.description}</Text>
                )}
                <Text style={styles.cardMeta}>
                  {p.colors_count} color{p.colors_count !== 1 ? 's' : ''}
                  {' · '}
                  {p.is_public ? '🌍 public' : '🔒 private'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create modal */}
      <Modal visible={creating} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Palette</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Palette name"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              maxLength={64}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Description (optional)"
              placeholderTextColor="#666"
              value={newDesc}
              onChangeText={setNewDesc}
              maxLength={160}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setCreating(false); setNewName(''); setNewDesc(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreate, !newName.trim() && styles.modalCreateDisabled]}
                onPress={handleCreate}
                disabled={saving || !newName.trim()}
              >
                <Text style={styles.modalCreateText}>{saving ? '…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loader: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  addBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyHint: { color: '#555', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#000', fontWeight: '700' },
  card: { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
  swatchStrip: { height: 64, flexDirection: 'row' },
  swatchSegment: { height: '100%' },
  cardBody: { padding: 14 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardDesc: { color: '#666', fontSize: 13, marginBottom: 6 },
  cardMeta: { color: '#444', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalInput: { backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalCreate: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center' },
  modalCreateDisabled: { backgroundColor: '#333' },
  modalCreateText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
