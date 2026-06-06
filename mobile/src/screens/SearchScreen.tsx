import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SectionList, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchColors, getTrending, getRecentDiscoveries } from '../api/palettes';
import { ColorData } from '../api/colors';

const { width: W } = Dimensions.get('window');
const TILE = (W - 40) / 4;

function getTextColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

function ColorTile({ c, size = TILE }: { c: ColorData; size?: number }) {
  const fg = getTextColor(c.r, c.g, c.b);
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: `#${c.hex_code}` }]}>
      {c.custom_name && (
        <Text style={[styles.tileName, { color: fg }]} numberOfLines={1}>{c.custom_name}</Text>
      )}
      <Text style={[styles.tileHex, { color: fg }]}>#{c.hex_code}</Text>
    </View>
  );
}

function HorizontalStrip({ title, data, loading }: { title: string; data: ColorData[]; loading: boolean }) {
  if (loading) return (
    <View style={styles.stripSection}>
      <Text style={styles.stripTitle}>{title}</Text>
      <ActivityIndicator color="#555" style={{ margin: 20 }} />
    </View>
  );
  if (data.length === 0) return null;
  return (
    <View style={styles.stripSection}>
      <Text style={styles.stripTitle}>{title}</Text>
      <SectionList
        sections={[]}
        renderItem={() => null}
        ListHeaderComponent={(
          <View style={styles.stripRow}>
            {data.slice(0, 8).map(c => <ColorTile key={c.hex_id} c={c} />)}
          </View>
        )}
      />
      <View style={styles.stripRow}>
        {data.slice(0, 8).map(c => <ColorTile key={c.hex_id} c={c} />)}
      </View>
    </View>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ColorData[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trending, setTrending] = useState<ColorData[]>([]);
  const [recent, setRecent] = useState<ColorData[]>([]);
  const [loadingBg, setLoadingBg] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([getTrending(), getRecentDiscoveries()])
      .then(([t, r]) => { setTrending(t.data); setRecent(r.data); })
      .catch(console.warn)
      .finally(() => setLoadingBg(false));
  }, []);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    try {
      const res = await searchColors(q.trim());
      setResults(res.data);
      setSearched(true);
    } catch (e) { console.warn(e); }
    finally { setSearching(false); }
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(text), 400);
  };

  const showDefault = !searched && !searching;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Hex code or color name…"
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

      {searching && <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />}

      {/* Search results */}
      {searched && !searching && (
        <>
          {results.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing found</Text>
              <Text style={styles.emptyHint}>Try a 6-digit hex like #A3F2BC or a community name</Text>
            </View>
          ) : (
            <View style={styles.resultGrid}>
              {results.map(c => {
                const fg = getTextColor(c.r, c.g, c.b);
                return (
                  <View key={c.hex_id} style={[styles.resultCard, { backgroundColor: `#${c.hex_code}` }]}>
                    {c.custom_name && (
                      <Text style={[styles.resultName, { color: fg }]} numberOfLines={1}>
                        "{c.custom_name}"
                      </Text>
                    )}
                    <Text style={[styles.resultHex, { color: fg }]}>#{c.hex_code}</Text>
                    {(c as any).discovered_by && (
                      <Text style={[styles.resultUser, { color: fg }]} numberOfLines={1}>
                        @{(c as any).discovered_by.username}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Default: trending + recent */}
      {showDefault && (
        <SectionList
          sections={[]}
          renderItem={() => null}
          keyExtractor={() => ''}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <>
              {/* Quick hex examples */}
              <View style={styles.exampleSection}>
                <Text style={styles.stripTitle}>Quick picks</Text>
                <View style={styles.exampleRow}>
                  {['FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','FF6B6B','6BCB77'].map(hex => (
                    <TouchableOpacity
                      key={hex}
                      style={[styles.exampleSwatch, { backgroundColor: `#${hex}` }]}
                      onPress={() => { setQuery(`#${hex}`); doSearch(`#${hex}`); }}
                    />
                  ))}
                </View>
              </View>

              {/* Trending */}
              <View style={styles.stripSection}>
                <Text style={styles.stripTitle}>🔥 Trending</Text>
                {loadingBg ? (
                  <ActivityIndicator color="#555" style={{ margin: 16 }} />
                ) : trending.length > 0 ? (
                  <View style={styles.stripRow}>
                    {trending.slice(0, 8).map(c => <ColorTile key={c.hex_id} c={c} />)}
                  </View>
                ) : (
                  <Text style={styles.stripEmpty}>No trending colors yet — start exploring!</Text>
                )}
              </View>

              {/* Recent discoveries */}
              <View style={styles.stripSection}>
                <Text style={styles.stripTitle}>✨ Recently Discovered</Text>
                {loadingBg ? (
                  <ActivityIndicator color="#555" style={{ margin: 16 }} />
                ) : recent.length > 0 ? (
                  <View style={styles.stripRow}>
                    {recent.slice(0, 8).map(c => <ColorTile key={c.hex_id} c={c} />)}
                  </View>
                ) : (
                  <Text style={styles.stripEmpty}>Be the first discoverer!</Text>
                )}
              </View>
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  searchBar:    { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: '#1a1a1a', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#2a2a2a' },
  searchIcon:   { fontSize: 15, marginRight: 8 },
  input:        { flex: 1, color: '#fff', fontSize: 16 },
  clearBtn:     { color: '#555', fontSize: 16, paddingLeft: 8 },
  empty:        { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle:   { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint:    { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  resultGrid:   { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  resultCard:   { width: (W - 40) / 2, height: (W - 40) / 2 * 0.75, borderRadius: 14, padding: 10, justifyContent: 'flex-end' },
  resultName:   { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  resultHex:    { fontSize: 14, fontWeight: '900' },
  resultUser:   { fontSize: 10, opacity: 0.7, marginTop: 2 },
  exampleSection:{ padding: 16, paddingBottom: 0 },
  exampleRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  exampleSwatch:{ width: TILE, height: TILE, borderRadius: 10 },
  stripSection: { padding: 16 },
  stripTitle:   { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  stripRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stripEmpty:   { color: '#444', fontSize: 13, marginTop: 4 },
  tile:         { borderRadius: 10, justifyContent: 'flex-end', padding: 4, margin: 0 },
  tileName:     { fontSize: 7, fontWeight: '700', marginBottom: 1 },
  tileHex:      { fontSize: 9, fontWeight: '900' },
});
