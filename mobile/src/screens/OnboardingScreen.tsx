import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const SLIDES = [
  {
    bg: '#FF5733',
    title: '16,777,216\ncolors.',
    subtitle: 'Every RGB color exists. Swipe through them like a feed — each one is unique.',
    icon: '⬡',
  },
  {
    bg: '#1A1AFF',
    title: 'Discover &\nclaim them.',
    subtitle: 'Be the first to stop on a color for 2 seconds and you become its discoverer. Name it.',
    icon: '🎉',
  },
  {
    bg: '#00C853',
    title: 'Build\npalettes.',
    subtitle: 'Save colors you love into curated palettes. Share them with the world.',
    icon: '▦',
  },
  {
    bg: '#FF00FF',
    title: 'Match the\ncolor.',
    subtitle: 'Play Color Match — identify colors by eye. Scored by scientific color distance.',
    icon: '🎯',
  },
];

function getTextColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

interface Props {
  onFinish: () => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList>(null);

  const next = () => {
    if (current < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: current + 1, animated: true });
      setCurrent(current + 1);
    } else {
      onFinish();
    }
  };

  const skip = () => onFinish();

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        renderItem={({ item: slide }) => {
          const fg = getTextColor(slide.bg);
          return (
            <View style={[styles.slide, { backgroundColor: slide.bg, paddingTop: insets.top + 40 }]}>
              <Text style={[styles.slideIcon, { color: fg }]}>{slide.icon}</Text>
              <Text style={[styles.slideTitle, { color: fg }]}>{slide.title}</Text>
              <Text style={[styles.slideSubtitle, { color: fg }]}>{slide.subtitle}</Text>
            </View>
          );
        }}
      />

      {/* Bottom controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                i === current && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.btnRow}>
          {current < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity style={styles.skipBtn} onPress={skip}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={next}>
                <Text style={styles.nextText}>Next →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, styles.startBtn]} onPress={onFinish}>
              <Text style={styles.nextText}>Start Exploring</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide:     { width: W, height: H, justifyContent: 'center', paddingHorizontal: 36 },
  slideIcon: { fontSize: 64, marginBottom: 24 },
  slideTitle:    { fontSize: 52, fontWeight: '900', lineHeight: 56, marginBottom: 20 },
  slideSubtitle: { fontSize: 18, lineHeight: 26, opacity: 0.8, fontWeight: '400' },
  controls:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent', padding: 24 },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  btnRow:    { flexDirection: 'row', gap: 12 },
  skipBtn:   { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  skipText:  { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 15 },
  nextBtn:   { flex: 2, padding: 16, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center' },
  startBtn:  { flex: 1 },
  nextText:  { color: '#000', fontWeight: '800', fontSize: 15 },
});
