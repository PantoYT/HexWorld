import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { login, register } from '../api/auth';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore(s => s.setAuth);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        if (!username) { Alert.alert('Username required'); setLoading(false); return; }
        result = await register({ email, password, username, display_name: displayName || username });
      }
      await setAuth(result.user, result.token);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>HexWorld</Text>
        <Text style={styles.tagline}>Discover 16,777,216 colors</Text>

        {mode === 'register' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Display name (optional)"
              placeholderTextColor="#666"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{mode === 'login' ? 'Log In' : 'Create Account'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(m => m === 'login' ? 'register' : 'login')}>
          <Text style={styles.switchText}>
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 42, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: 2 },
  tagline: { fontSize: 15, color: '#888', marginBottom: 40 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#222',
  },
  btn: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  switchText: { color: '#666', textAlign: 'center', marginTop: 20, fontSize: 14 },
});
