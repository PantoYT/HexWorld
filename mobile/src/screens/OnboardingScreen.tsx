import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const fade = useRef(new Animated.Value(1)).current;

  // Cross-fade the slide whenever the index changes.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [current]);

  const next = () => {
    if (current < SLIDES.length - 1) {
      setCurrent(c => c + 1);
    } else {
      onFinish();
    }
  };

  const slide = SLIDES[current];
  const fg = getTextColor(slide.bg);
  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      {/* Slide content (single, index-driven — reliable on web + native) */}
      <Animated.View style={[styles.slide, { paddingTop: insets.top + 40, opacity: fade }]}>
        <Text style={[styles.slideIcon, { color: fg }]}>{slide.icon}</Text>
        <Text style={[styles.slideTitle, { color: fg }]}>{slide.title}</Text>
        <Text style={[styles.slideSubtitle, { color: fg }]}>{slide.subtitle}</Text>
      </Animated.View>

      {/* Bottom controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === current ? fg : `${fg}55` },
                i === current && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.btnRow}>
          {!isLast ? (
            <>
              <TouchableOpacity style={[styles.skipBtn, { borderColor: `${fg}44` }]} onPress={onFinish}>
                <Text style={[styles.skipText, { color: fg }]}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { backgroundColor: fg }]} onPress={next}>
                <Text style={[styles.nextText, { color: slide.bg }]}>Next →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, styles.startBtn, { backgroundColor: fg }]} onPress={onFinish}>
              <Text style={[styles.nextText, { color: slide.bg }]}>Start Exploring</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide:     { flex: 1, width: W, justifyContent: 'center', paddingHorizontal: 36 },
  slideIcon: { fontSize: 64, marginBottom: 24 },
  slideTitle:    { fontSize: 52, fontWeight: '900', lineHeight: 56, marginBottom: 20 },
  slideSubtitle: { fontSize: 18, lineHeight: 26, opacity: 0.8, fontWeight: '400' },
  controls:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 20 },
  btnRow:    { flexDirection: 'row', gap: 12 },
  skipBtn:   { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  skipText:  { fontWeight: '600', fontSize: 15, opacity: 0.8 },
  nextBtn:   { flex: 2, padding: 16, borderRadius: 14, alignItems: 'center' },
  startBtn:  { flex: 1 },
  nextText:  { fontWeight: '800', fontSize: 15 },
});
