import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchColors } from '../api/palettes';
import { ColorData } from '../api/colors';

const { width: W } = Dimensions.get('window');
const SWATCH = (W - 48) / 4;

function getTextColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const res = await searchColors(q.trim());
      setResults(res.data);
      setSearched(true);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(text), 400);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search hex (#FF5733) or name..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={onChangeText}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />}

      {!loading && searched && results.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No colors found</Text>
          <Text style={styles.emptyHint}>Try a 6-digit hex code like #A3F2BC or a community name</Text>
        </View>
      )}

      {!loading && !searched && (
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>16,777,216 colors</Text>
          <Text style={styles.hintText}>Search by hex code or community name</Text>
          <View style={styles.exampleRow}>
            {['FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF'].map(hex => (
              <TouchableOpacity
                key={hex}
                style={[styles.exampleSwatch, { backgroundColor: `#${hex}` }]}
                onPress={() => { setQuery(`#${hex}`); doSearch(`#${hex}`); }}
              />
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={c => String(c.hex_id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        renderItem={({ item: c }) => {
          const fg = getTextColor(c.r, c.g, c.b);
          return (
            <View style={[styles.resultCard, { backgroundColor: `#${c.hex_code}` }]}>
              {c.custom_name && (
                <Text style={[styles.resultName, { color: fg }]} numberOfLines={1}>
                  "{c.custom_name}"
                </Text>
              )}
              <Text style={[styles.resultHex, { color: fg }]}>#{c.hex_code}</Text>
              {c.discovered_by && (
                <Text style={[styles.resultUser, { color: fg }]} numberOfLines={1}>
                  @{c.discovered_by.username}
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', margin: 16,
    backgroundColor: '#1a1a1a', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, color: '#fff', fontSize: 16 },
  clearBtn: { color: '#555', fontSize: 16, paddingLeft: 8 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  hint: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  hintTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  hintText: { color: '#555', fontSize: 14, marginBottom: 32 },
  exampleRow: { flexDirection: 'row', gap: 10 },
  exampleSwatch: { width: 40, height: 40, borderRadius: 10 },
  grid: { padding: 12, gap: 12 },
  resultCard: {
    flex: 1, margin: 4, height: SWATCH * 1.2,
    borderRadius: 14, padding: 12, justifyContent: 'flex-end',
  },
  resultName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  resultHex: { fontSize: 14, fontWeight: '900' },
  resultUser: { fontSize: 10, opacity: 0.7, marginTop: 2 },
});
