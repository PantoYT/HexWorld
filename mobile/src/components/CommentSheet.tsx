import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Animated,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { getComments, postComment } from '../api/colors';

const { height: H } = Dimensions.get('window');

interface Comment {
  id: string;
  body: string;
  likes_count: number;
  created_at: string;
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
}

interface Props {
  hexId: number;
  hexCode: string;
  visible: boolean;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}

export default function CommentSheet({ hexId, hexCode, visible, onClose, onCountChange }: Props) {
  const translateY = useRef(new Animated.Value(H)).current;
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : H,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    if (visible && comments.length === 0) {
      setLoading(true);
      getComments(hexId)
        .then(r => setComments(r.data ?? []))
        .catch(console.warn)
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const c = await postComment(hexId, body.trim());
      setComments(prev => [c, ...prev]);
      onCountChange(1);
      setBody('');
    } catch (e) { console.warn(e); }
    finally { setSending(false); }
  };

  return (
    <>
      {visible && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      )}
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Comments on #{hexCode}</Text>

        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={c => c.id}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No comments yet. Be the first!</Text>}
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <View style={styles.commentMeta}>
                  <Text style={styles.commentUser}>@{item.user.username}</Text>
                  <Text style={styles.commentTime}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.commentBody}>{item.body}</Text>
              </View>
            )}
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment…"
              placeholderTextColor="#555"
              value={body}
              onChangeText={setBody}
              maxLength={280}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
              <Text style={styles.sendText}>{sending ? '…' : '↑'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: H * 0.65, backgroundColor: '#111',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    zIndex: 11, paddingHorizontal: 16, paddingBottom: 8,
  },
  handle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  list: { flex: 1 },
  empty: { color: '#555', textAlign: 'center', marginTop: 32, fontSize: 14 },
  comment: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentUser: { color: '#aaa', fontSize: 12, fontWeight: '700' },
  commentTime: { color: '#444', fontSize: 11 },
  commentBody: { color: '#eee', fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  input: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
