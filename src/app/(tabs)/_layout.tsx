import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#34d399', // Mint / Emerald active state
        tabBarInactiveTintColor: '#6b7280', // Grey inactive state
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 16,
          right: 16,
          borderRadius: 24,
          backgroundColor: 'rgba(3, 20, 16, 0.88)', // Deep space glassmorphism
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(16, 185, 129, 0.15)', // Soft emerald glow border
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      {/* Primary Navigation Tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mirror',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'body' : 'body-outline'} size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dinacharya"
        options={{
          title: 'Path',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Oracle',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'eye' : 'eye-outline'} size={21} color={color} />
          ),
        }}
      />

      {/* Hidden Screens (Navigate-able but omitted from bottom tab bar) */}
      <Tabs.Screen
        name="coach"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="device"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="digital-twin"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="food-journal"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="food-analysis"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="device-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="live-monitor"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
