import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

interface Props {
  visible: boolean;
}

export default function LikeAnimation({ visible }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    opacity.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, tension: 200, friction: 5 }),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.heart}>♥</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: '35%', left: '50%', marginLeft: -40, zIndex: 20, pointerEvents: 'none' },
  heart: { fontSize: 80, color: '#ff3b30' },
});
