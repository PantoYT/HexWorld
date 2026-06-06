import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import FeedScreen from '../screens/FeedScreen';
import SearchScreen from '../screens/SearchScreen';
import ColorOfTheDayScreen from '../screens/ColorOfTheDayScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import PalettesScreen from '../screens/PalettesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ONBOARDING_KEY = 'hexworld_onboarded';

function getStorage() {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, val: string) => { localStorage.setItem(key, val); return Promise.resolve(); },
    };
  }
  // On native, use a simple in-memory fallback (replace with AsyncStorage if installed)
  const mem: Record<string, string> = {};
  return {
    getItem: (key: string) => Promise.resolve(mem[key] ?? null),
    setItem: (key: string, val: string) => { mem[key] = val; return Promise.resolve(); },
  };
}

const storage = getStorage();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a', height: 60 },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#444',
        tabBarLabelStyle: { fontSize: 10, marginBottom: 4 },
      }}
    >
      <Tab.Screen name="Feed"         component={FeedScreen}          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⬡</Text>,  tabBarLabel: 'Explore'  }} />
      <Tab.Screen name="Search"       component={SearchScreen}        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔍</Text>, tabBarLabel: 'Search'   }} />
      <Tab.Screen name="ColorOfTheDay" component={ColorOfTheDayScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>✦</Text>,  tabBarLabel: 'Today'    }} />
      <Tab.Screen name="Challenge"    component={ChallengeScreen}     options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🎯</Text>, tabBarLabel: 'Match'    }} />
      <Tab.Screen name="Palettes"     component={PalettesScreen}      options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>▦</Text>,  tabBarLabel: 'Palettes' }} />
      <Tab.Screen name="Profile"      component={ProfileScreen}       options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◉</Text>,  tabBarLabel: 'Profile'  }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, hydrated } = useAuthStore();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    storage.getItem(ONBOARDING_KEY).then(val => setOnboarded(val === 'yes'));
  }, []);

  const finishOnboarding = async () => {
    await storage.setItem(ONBOARDING_KEY, 'yes');
    setOnboarded(true);
  };

  if (!hydrated || onboarded === null) return null;

  // New user (logged out + never onboarded) → show onboarding first
  if (!user && !onboarded) {
    return <OnboardingScreen onFinish={finishOnboarding} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
