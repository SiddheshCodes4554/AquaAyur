import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#607C64', // Sage Green active state
        tabBarInactiveTintColor: '#8C958E', // Grey-green inactive state
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 16,
          right: 16,
          borderRadius: 24,
          backgroundColor: '#FFFFFF', // Pure white background
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: '#E4E1D8', // Warm soft border
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          shadowColor: '#2C2D24',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
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
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'school' : 'school-outline'} size={21} color={color} />
          ),
        }}
      />

      {/* Hidden Screens (Navigate-able but omitted from bottom tab bar) */}
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Guru',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={21} color={color} />
          ),
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
          title: 'Vitals',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
