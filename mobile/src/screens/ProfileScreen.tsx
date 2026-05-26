import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { logout } from '../api/auth';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout: storeLogout } = useAuthStore();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    storeLogout();
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.username}>@{user.username}</Text>
      {user.display_name !== user.username && (
        <Text style={styles.displayName}>{user.display_name}</Text>
      )}
      {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{user.discovered_count}</Text>
          <Text style={styles.statLabel}>Discovered</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{user.followers_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{user.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24 },
  username: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  displayName: { fontSize: 16, color: '#888', marginBottom: 8 },
  bio: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  stats: { flexDirection: 'row', gap: 32, marginBottom: 40 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  logoutBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  logoutText: { color: '#ff3b30', fontWeight: '700' },
});
