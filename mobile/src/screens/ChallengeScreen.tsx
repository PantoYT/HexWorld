import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');
const ROUND_SECONDS = 30;
const ROUNDS = 5;

// deltaE CIE76 in Lab space
function rgbToLab(r: number, g: number, b: number) {
  let r1 = r / 255, g1 = g / 255, b1 = b / 255;
  r1 = r1 > 0.04045 ? ((r1 + 0.055) / 1.055) ** 2.4 : r1 / 12.92;
  g1 = g1 > 0.04045 ? ((g1 + 0.055) / 1.055) ** 2.4 : g1 / 12.92;
  b1 = b1 > 0.04045 ? ((b1 + 0.055) / 1.055) ** 2.4 : b1 / 12.92;
  let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) / 0.95047;
  let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) / 1.00000;
  let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) / 1.08883;
  x = x > 0.008856 ? x ** (1/3) : 7.787 * x + 16/116;
  y = y > 0.008856 ? y ** (1/3) : 7.787 * y + 16/116;
  z = z > 0.008856 ? z ** (1/3) : 7.787 * z + 16/116;
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function deltaE(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const lab1 = rgbToLab(r1, g1, b1);
  const lab2 = rgbToLab(r2, g2, b2);
  return Math.sqrt(
    (lab1.L - lab2.L) ** 2 +
    (lab1.a - lab2.a) ** 2 +
    (lab1.b - lab2.b) ** 2
  );
}

function randomRgb() {
  return { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256) };
}

function getTextColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

function scoreFromDelta(delta: number): number {
  // delta 0 = 1000 pts, delta 100 = 0 pts
  return Math.max(0, Math.round(1000 - delta * 10));
}

interface Round {
  target: { r: number; g: number; b: number };
  chosen: { r: number; g: number; b: number } | null;
  delta: number | null;
  score: number | null;
  timeLeft: number;
}

type Phase = 'menu' | 'playing' | 'result';

const CHOICE_COUNT = 6;

export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('menu');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [choices, setChoices] = useState<{ r: number; g: number; b: number }[]>([]);
  const [chosen, setChosen] = useState<{ r: number; g: number; b: number } | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;

  const startGame = useCallback(() => {
    const newRounds: Round[] = Array.from({ length: ROUNDS }, () => ({
      target: randomRgb(),
      chosen: null,
      delta: null,
      score: null,
      timeLeft: ROUND_SECONDS,
    }));
    setRounds(newRounds);
    setCurrentRound(0);
    setTotalScore(0);
    setChosen(null);
    setPhase('playing');
    generateChoices(newRounds[0].target);
    startTimer();
  }, []);

  const generateChoices = (target: { r: number; g: number; b: number }) => {
    // 1 very close, 2 medium, 3 random
    const close = { r: clamp(target.r + rand(-20, 20)), g: clamp(target.g + rand(-20, 20)), b: clamp(target.b + rand(-20, 20)) };
    const medium1 = { r: clamp(target.r + rand(-60, 60)), g: clamp(target.g + rand(-60, 60)), b: clamp(target.b + rand(-60, 60)) };
    const medium2 = { r: clamp(target.r + rand(-80, 80)), g: clamp(target.g + rand(-80, 80)), b: clamp(target.b + rand(-80, 80)) };
    const mix = [target, close, medium1, medium2, randomRgb(), randomRgb()];
    // shuffle
    for (let i = mix.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mix[i], mix[j]] = [mix[j], mix[i]];
    }
    setChoices(mix);
  };

  const startTimer = () => {
    setTimeLeft(ROUND_SECONDS);
    timerAnim.setValue(1);
    Animated.timing(timerAnim, { toValue: 0, duration: ROUND_SECONDS * 1000, useNativeDriver: false }).start();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRounds(prev => {
      const updated = [...prev];
      const r = updated[currentRound];
      if (!r.chosen) {
        r.chosen = randomRgb(); // penalty: random
        r.delta = 100;
        r.score = 0;
      }
      return updated;
    });
    setTimeout(() => nextRound(), 1500);
  };

  const handleChoose = (c: { r: number; g: number; b: number }) => {
    if (chosen) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const target = rounds[currentRound].target;
    const delta = deltaE(target.r, target.g, target.b, c.r, c.g, c.b);
    const score = scoreFromDelta(delta);
    setChosen(c);
    setTotalScore(prev => prev + score);
    setRounds(prev => {
      const updated = [...prev];
      updated[currentRound] = { ...updated[currentRound], chosen: c, delta, score };
      return updated;
    });
    setTimeout(() => nextRound(), 1200);
  };

  const nextRound = () => {
    const next = currentRound + 1;
    if (next >= ROUNDS) {
      setPhase('result');
    } else {
      setCurrentRound(next);
      setChosen(null);
      generateChoices(rounds[next].target);
      startTimer();
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ─── MENU ────────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>Color Match</Text>
        <Text style={styles.subtitle}>
          A target color appears — pick the closest match{'\n'}from 6 options in {ROUND_SECONDS} seconds.
        </Text>

        <View style={styles.demoRow}>
          {[0xFF3B30, 0x34C759, 0x007AFF, 0xFFCC00, 0xFF2D55, 0x5856D6].map(hex => (
            <View key={hex} style={[styles.demoSwatch, { backgroundColor: `#${hex.toString(16).padStart(6,'0').toUpperCase()}` }]} />
          ))}
        </View>

        <View style={styles.rules}>
          <RuleItem icon="🎯" text={`${ROUNDS} rounds, ${ROUND_SECONDS}s each`} />
          <RuleItem icon="📐" text="Scored by color distance (deltaE)" />
          <RuleItem icon="⚡" text="Faster guesses aren't scored higher — accuracy counts" />
          <RuleItem icon="🏆" text="Max 1000 pts per round" />
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>Start Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── RESULT ──────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const maxScore = ROUNDS * 1000;
    const pct = Math.round((totalScore / maxScore) * 100);
    const grade = pct >= 90 ? 'S' : pct >= 75 ? 'A' : pct >= 55 ? 'B' : pct >= 35 ? 'C' : 'D';
    const gradeColor = pct >= 90 ? '#FFD700' : pct >= 75 ? '#34C759' : pct >= 55 ? '#007AFF' : pct >= 35 ? '#FF9500' : '#FF3B30';

    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 60 }}>
        <Text style={styles.title}>Results</Text>
        <View style={styles.resultHero}>
          <Text style={[styles.grade, { color: gradeColor }]}>{grade}</Text>
          <Text style={styles.totalScore}>{totalScore.toLocaleString()} pts</Text>
          <Text style={styles.totalPct}>{pct}% accuracy</Text>
        </View>

        <View style={styles.roundList}>
          {rounds.map((r, i) => {
            const tFg = getTextColor(r.target.r, r.target.g, r.target.b);
            const cFg = r.chosen ? getTextColor(r.chosen.r, r.chosen.g, r.chosen.b) : '#fff';
            return (
              <View key={i} style={styles.roundRow}>
                <Text style={styles.roundNum}>#{i + 1}</Text>
                <View style={[styles.roundSwatch, { backgroundColor: `rgb(${r.target.r},${r.target.g},${r.target.b})` }]}>
                  <Text style={[styles.roundSwatchLabel, { color: tFg }]}>Target</Text>
                </View>
                {r.chosen && (
                  <View style={[styles.roundSwatch, { backgroundColor: `rgb(${r.chosen.r},${r.chosen.g},${r.chosen.b})` }]}>
                    <Text style={[styles.roundSwatchLabel, { color: cFg }]}>Picked</Text>
                  </View>
                )}
                <View style={styles.roundScore}>
                  <Text style={styles.roundScoreNum}>{r.score ?? 0}</Text>
                  <Text style={styles.roundDelta}>Δ{r.delta?.toFixed(1)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setPhase('menu')}>
          <Text style={styles.menuBtnText}>Menu</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── PLAYING ─────────────────────────────────────────────────────────────────
  const target = rounds[currentRound]?.target;
  if (!target) return null;
  const tFg = getTextColor(target.r, target.g, target.b);
  const timerColor = timerAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: ['#ff3b30', '#ff9500', '#34c759'] });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.playHeader}>
        <Text style={styles.roundIndicator}>Round {currentRound + 1}/{ROUNDS}</Text>
        <Text style={styles.scoreCounter}>{totalScore.toLocaleString()} pts</Text>
        <Text style={styles.timerNum}>{timeLeft}s</Text>
      </View>

      {/* Timer bar */}
      <Animated.View style={[styles.timerBar, { width: timerAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }), backgroundColor: timerColor }]} />

      {/* Target swatch */}
      <View style={[styles.targetSwatch, { backgroundColor: `rgb(${target.r},${target.g},${target.b})` }]}>
        <Text style={[styles.targetLabel, { color: tFg }]}>Match this color</Text>
        {chosen && (
          <Text style={[styles.targetHint, { color: tFg }]}>
            #{((target.r << 16) | (target.g << 8) | target.b).toString(16).padStart(6,'0').toUpperCase()}
          </Text>
        )}
      </View>

      {/* Choice grid */}
      <View style={styles.choiceGrid}>
        {choices.map((c, i) => {
          const fg = getTextColor(c.r, c.g, c.b);
          const isChosen = chosen && c.r === chosen.r && c.g === chosen.g && c.b === chosen.b;
          const isTarget = chosen && c.r === target.r && c.g === target.g && c.b === target.b;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.choiceCard,
                { backgroundColor: `rgb(${c.r},${c.g},${c.b})` },
                isTarget && styles.choiceCorrect,
                isChosen && !isTarget && styles.choiceWrong,
              ]}
              onPress={() => handleChoose(c)}
              disabled={!!chosen}
              activeOpacity={0.85}
            >
              {chosen && (
                <Text style={[styles.choiceHex, { color: fg }]}>
                  #{((c.r << 16) | (c.g << 8) | c.b).toString(16).padStart(6,'0').toUpperCase()}
                </Text>
              )}
              {isChosen && rounds[currentRound]?.score !== null && (
                <Text style={[styles.choiceScore, { color: fg }]}>
                  +{rounds[currentRound].score}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function RuleItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.ruleItem}>
      <Text style={styles.ruleIcon}>{icon}</Text>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const CARD = (W - 48) / 3;

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  title:        { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  subtitle:     { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 32 },
  demoRow:      { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  demoSwatch:   { width: 36, height: 36, borderRadius: 10 },
  rules:        { paddingHorizontal: 24, gap: 12, marginBottom: 40 },
  ruleItem:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleIcon:     { fontSize: 20, width: 28 },
  ruleText:     { color: '#aaa', fontSize: 14, flex: 1 },
  startBtn:     { marginHorizontal: 24, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  startBtnText: { color: '#000', fontWeight: '900', fontSize: 17 },
  menuBtn:      { marginHorizontal: 24, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, alignItems: 'center' },
  menuBtnText:  { color: '#666', fontWeight: '700' },
  // result
  resultHero:   { alignItems: 'center', paddingVertical: 32 },
  grade:        { fontSize: 80, fontWeight: '900', lineHeight: 88 },
  totalScore:   { color: '#fff', fontSize: 36, fontWeight: '900', marginTop: 8 },
  totalPct:     { color: '#666', fontSize: 16, marginTop: 4 },
  roundList:    { paddingHorizontal: 16, gap: 10, marginBottom: 32 },
  roundRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundNum:     { color: '#555', fontSize: 13, width: 24 },
  roundSwatch:  { width: 52, height: 52, borderRadius: 10, justifyContent: 'flex-end', padding: 4 },
  roundSwatchLabel: { fontSize: 7, fontWeight: '700' },
  roundScore:   { flex: 1, alignItems: 'flex-end' },
  roundScoreNum:{ color: '#fff', fontSize: 18, fontWeight: '800' },
  roundDelta:   { color: '#555', fontSize: 11, marginTop: 2 },
  // playing
  playHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  roundIndicator: { color: '#888', fontSize: 13, fontWeight: '600' },
  scoreCounter: { color: '#fff', fontSize: 15, fontWeight: '800' },
  timerNum:     { color: '#888', fontSize: 13, fontWeight: '600' },
  timerBar:     { height: 3, backgroundColor: '#34c759', marginBottom: 0 },
  targetSwatch: { height: W * 0.55, marginHorizontal: 16, marginVertical: 12, borderRadius: 20, justifyContent: 'flex-end', padding: 16 },
  targetLabel:  { fontSize: 13, fontWeight: '700', opacity: 0.8 },
  targetHint:   { fontSize: 20, fontWeight: '900', marginTop: 2 },
  choiceGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  choiceCard:   { width: CARD, height: CARD * 0.8, borderRadius: 14, justifyContent: 'flex-end', padding: 8 },
  choiceCorrect:{ borderWidth: 3, borderColor: '#34c759' },
  choiceWrong:  { borderWidth: 3, borderColor: '#ff3b30', opacity: 0.7 },
  choiceHex:    { fontSize: 9, fontWeight: '700' },
  choiceScore:  { fontSize: 14, fontWeight: '900', marginTop: 2 },
});
