import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Dimensions, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUser, getUserDiscovered, followUser, unfollowUser, PublicUser } from '../api/users';
import { ColorData } from '../api/colors';
import ColorDetailScreen from './ColorDetailScreen';

const { width: W } = Dimensions.get('window');
const TILE = (W - 4) / 3;

interface Props {
  username: string;
  onClose: () => void;
}

export default function PublicProfileScreen({ username, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [detailHexId, setDetailHexId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getUser(username), getUserDiscovered(username, 1)])
      .then(([u, d]) => {
        setUser(u);
        setColors(d.data);
        setLastPage(d.meta.last_page);
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [username]);

  const loadMore = async () => {
    if (loadingMore || page >= lastPage) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const d = await getUserDiscovered(username, next);
      setColors(prev => [...prev, ...d.data]);
      setPage(next);
    } catch (e) { console.warn(e); }
    finally { setLoadingMore(false); }
  };

  const toggleFollow = async () => {
    if (!user || followBusy) return;
    setFollowBusy(true);
    // Optimistic update
    const wasFollowing = user.is_following;
    setUser({
      ...user,
      is_following: !wasFollowing,
      followers_count: user.followers_count + (wasFollowing ? -1 : 1),
    });
    try {
      wasFollowing ? await unfollowUser(username) : await followUser(username);
    } catch (e) {
      // Revert on failure
      setUser(u => u && ({ ...u, is_following: wasFollowing, followers_count: user.followers_count }));
      console.warn(e);
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading || !user) {
    return <View style={styles.loader}><ActivityIndicator color="#fff" size="large" /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={colors}
        keyExtractor={c => String(c.hex_id)}
        numColumns={3}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={(
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{user.username[0].toUpperCase()}</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.displayName}>{user.display_name}</Text>
                <Text style={styles.username}>@{user.username}</Text>
                {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <Stat value={user.discovered_count} label="Discovered" />
              <View style={styles.statDivider} />
              <Stat value={user.followers_count} label="Followers" />
              <View style={styles.statDivider} />
              <Stat value={user.following_count} label="Following" />
            </View>

            {/* Follow button (hidden on own profile) */}
            {!user.is_self && (
              <TouchableOpacity
                style={[styles.followBtn, user.is_following && styles.followingBtn]}
                onPress={toggleFollow}
                disabled={followBusy}
              >
                <Text style={[styles.followText, user.is_following && styles.followingText]}>
                  {user.is_following ? '✓ Following' : '+ Follow'}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>DISCOVERED</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyText}>No discoveries yet</Text>
          </View>
        )}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#fff" style={{ padding: 20 }} /> : <View style={{ height: insets.bottom + 24 }} />}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[styles.tile, { backgroundColor: `#${c.hex_code}` }]}
            onPress={() => setDetailHexId(c.hex_id)}
            activeOpacity={0.8}
          >
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
          </TouchableOpacity>
        )}
      />

      {/* Color detail modal */}
      <Modal visible={detailHexId !== null} animationType="slide" presentationStyle="pageSheet">
        {detailHexId !== null && (
          <ColorDetailScreen hexId={detailHexId} onClose={() => setDetailHexId(null)} />
        )}
      </Modal>
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
  loader: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  topBar: { paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  backText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  header: { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'flex-start' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '900' },
  headerInfo: { flex: 1 },
  displayName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  username: { color: '#666', fontSize: 14, marginTop: 2 },
  bio: { color: '#888', fontSize: 13, marginTop: 6, lineHeight: 18 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#555', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#1a1a1a' },
  followBtn: { marginHorizontal: 20, marginBottom: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center' },
  followingBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  followText: { color: '#000', fontWeight: '800', fontSize: 15 },
  followingText: { color: '#fff' },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 2, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tile: { width: TILE, height: TILE, margin: 0.5, justifyContent: 'flex-end', padding: 4 },
  tileName: { fontSize: 8, fontWeight: '700' },
  emptyGrid: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 14 },
});
