import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { logout } from '../api/auth';
import { api } from '../api/client';
import { ColorData } from '../api/colors';

const { width: W } = Dimensions.get('window');
const TILE = (W - 4) / 3;

type Tab = 'discovered' | 'liked';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout: storeLogout } = useAuthStore();
  const [tab, setTab] = useState<Tab>('discovered');
  const [colors, setColors] = useState<ColorData[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchColors = useCallback(async (t: Tab, p: number, reset = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const endpoint = t === 'discovered'
        ? `/users/${user.username}/discovered`
        : `/users/${user.username}/liked`;
      const res = await api.get(endpoint, { params: { page: p, limit: 24 } });
      const { data, meta } = res.data;
      setColors(prev => reset ? data : [...prev, ...data]);
      setLastPage(meta?.last_page ?? 1);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    setColors([]);
    setPage(1);
    fetchColors(tab, 1, true);
  }, [tab]);

  const loadMore = () => {
    if (loading || page >= lastPage) return;
    const next = page + 1;
    setPage(next);
    fetchColors(tab, next);
  };

  const handleLogout = async () => {
    try { await logout(); } catch {}
    storeLogout();
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={colors}
        keyExtractor={c => String(c.hex_id)}
        numColumns={3}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={(
          <View>
            {/* Profile header */}
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {user.username[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.displayName}>{user.display_name}</Text>
                <Text style={styles.username}>@{user.username}</Text>
                {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <Stat value={user.discovered_count} label="Discovered" />
              <View style={styles.statDivider} />
              <Stat value={user.followers_count} label="Followers" />
              <View style={styles.statDivider} />
              <Stat value={user.following_count} label="Following" />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'discovered' && styles.tabActive]}
                onPress={() => setTab('discovered')}
              >
                <Text style={[styles.tabText, tab === 'discovered' && styles.tabTextActive]}>
                  Discovered
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'liked' && styles.tabActive]}
                onPress={() => setTab('liked')}
              >
                <Text style={[styles.tabText, tab === 'liked' && styles.tabTextActive]}>
                  Liked
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={loading ? <ActivityIndicator color="#fff" style={{ padding: 20 }} /> : null}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyText}>
              {tab === 'discovered' ? 'No discoveries yet' : 'No liked colors yet'}
            </Text>
          </View>
        ) : null}
        renderItem={({ item: c }) => (
          <View style={[styles.tile, { backgroundColor: `#${c.hex_code}` }]}>
            {c.custom_name && (
              <Text
                style={[styles.tileName, {
                  color: (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.5 ? '#000' : '#fff'
                }]}
                numberOfLines={1}
              >
                {c.custom_name}
              </Text>
            )}
          </View>
        )}
        ListFooterComponentStyle={{ paddingBottom: insets.bottom + 80 }}
      />

      {/* Logout button — fixed at bottom */}
      <TouchableOpacity
        style={[styles.logoutBtn, { bottom: insets.bottom + 90 }]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'flex-start' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '900' },
  headerInfo: { flex: 1 },
  displayName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  username: { color: '#666', fontSize: 14, marginTop: 2 },
  bio: { color: '#888', fontSize: 13, marginTop: 6, lineHeight: 18 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#555', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#1a1a1a' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { color: '#555', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  tile: { width: TILE, height: TILE, margin: 0.5, justifyContent: 'flex-end', padding: 4 },
  tileName: { fontSize: 8, fontWeight: '700' },
  emptyGrid: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 14 },
  logoutBtn: {
    position: 'absolute', right: 16,
    backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  logoutText: { color: '#ff3b30', fontWeight: '700', fontSize: 13 },
});
