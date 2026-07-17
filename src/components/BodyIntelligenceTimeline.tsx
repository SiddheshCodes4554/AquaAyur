import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Mock Haptics using built-in React Native Vibration to resolve the missing expo-haptics dependency
const Haptics = {
  impactAsync: (style?: any) => {
    try {
      Vibration.vibrate(15);
    } catch (e) {}
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy'
  },
  notificationAsync: (type?: any) => {
    try {
      Vibration.vibrate(30);
    } catch (e) {}
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error'
  }
};

interface BodyIntelligenceTimelineProps {
  date: string;
  dosha: string;
  hr: number;
  sleepScore: number;
  steps: number;
  primaryImbalance: 'vata' | 'pitta' | 'kapha' | 'homeostasis';
}

interface TimelineNode {
  id: string;
  label: string;
  subLabel: string;
  icon: string;
  color: string; // Tailwind text color class
  bgColor: string; // Tailwind bg color class
  borderColor: string;
  explanation: string;
}

export default function BodyIntelligenceTimeline({
  date,
  dosha,
  hr,
  sleepScore,
  steps,
  primaryImbalance
}: BodyIntelligenceTimelineProps) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Generate dynamic nodes based on vitals parameters
  const nodes = React.useMemo<TimelineNode[]>(() => {
    const list: TimelineNode[] = [];

    // Node 1: Trigger / Cause
    if (sleepScore > 0 && sleepScore < 70) {
      list.push({
        id: 'trigger',
        label: 'Late Bedtime / Screen Time',
        subLabel: 'Circadian shift',
        icon: 'moon-outline',
        color: 'text-violet-400',
        bgColor: 'bg-violet-950/20',
        borderColor: 'border-violet-900/30',
        explanation: 'Your sleep window shifted past 11:30 PM last night, delaying circadian hormone release and tissue repair.'
      });
    } else if (steps > 0 && steps < 3000) {
      list.push({
        id: 'trigger',
        label: 'Sedentary / Desk Day',
        subLabel: 'Physical inactivity',
        icon: 'briefcase-outline',
        color: 'text-teal-400',
        bgColor: 'bg-teal-950/20',
        borderColor: 'border-teal-900/30',
        explanation: 'Low movement steps lead to stagnation of Kapha elements, restricting circulation and slowing down the metabolic rate.'
      });
    } else if (hr > 76) {
      list.push({
        id: 'trigger',
        label: 'Spicy Meal / High Stress',
        subLabel: 'Metabolic stress trigger',
        icon: 'flash-outline',
        color: 'text-orange-400',
        bgColor: 'bg-orange-950/20',
        borderColor: 'border-orange-900/30',
        explanation: 'Elevated cardiac rate reflects an active sympathetic nervous reaction, often caused by late heavy meals or emotional stress.'
      });
    } else {
      list.push({
        id: 'trigger',
        label: 'Early Rest & Calm Mind',
        subLabel: 'Optimal lifestyle trigger',
        icon: 'leaf-outline',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/20',
        borderColor: 'border-emerald-900/30',
        explanation: 'Sleeping early and keeping hydrated allows the body to restore Ojas immunity and enter deep repair states.'
      });
    }

    // Node 2: First Reaction
    if (sleepScore > 0 && sleepScore < 70) {
      list.push({
        id: 'reaction',
        label: 'Interrupted Sleep Cycles',
        subLabel: 'Poor Rest Recovery',
        icon: 'bed-outline',
        color: 'text-violet-400',
        bgColor: 'bg-violet-950/20',
        borderColor: 'border-violet-900/30',
        explanation: `With a sleep score of only ${sleepScore}/100, your body missed key deep sleep segments needed for muscular repair.`
      });
    } else if (steps > 0 && steps < 3000) {
      list.push({
        id: 'reaction',
        label: 'Sluggish Circulation',
        subLabel: 'Fluid Stagnation',
        icon: 'water-outline',
        color: 'text-teal-400',
        bgColor: 'bg-teal-950/20',
        borderColor: 'border-teal-900/30',
        explanation: 'Decreased physical steps cause lymph and blood circulation velocity to decrease, leaving muscles feeling tight.'
      });
    } else {
      list.push({
        id: 'reaction',
        label: 'Restful Sleep Cycles',
        subLabel: 'Deep Recovery',
        icon: 'shield-checkmark-outline',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/20',
        borderColor: 'border-emerald-900/30',
        explanation: `Achieving ${sleepScore}/100 sleep score indicates your deep sleep cycles were fully restored to baseline.`
      });
    }

    // Node 3: Biometric Indicator
    if (hr > 0) {
      const isElevated = hr > 76;
      list.push({
        id: 'indicator',
        label: isElevated ? `Elevated Heart Rate (${hr} bpm)` : `Steady Pulse Rate (${hr} bpm)`,
        subLabel: 'PPG Sensor Reading',
        icon: 'pulse-outline',
        color: isElevated ? 'text-rose-400' : 'text-emerald-400',
        bgColor: isElevated ? 'bg-rose-950/20' : 'bg-emerald-950/20',
        borderColor: isElevated ? 'border-rose-900/30' : 'border-emerald-900/30',
        explanation: isElevated 
          ? `Your paired ESP32 band tracked an average heart rate of ${hr} bpm, showing physiological strain.`
          : `Your paired ESP32 band tracked a calm, rhythmic pulse of ${hr} bpm, showing excellent autonomic nervous balance.`
      });
    } else {
      list.push({
        id: 'indicator',
        label: 'Calm Skin Temperature',
        subLabel: 'Thermistor Sensor Reading',
        icon: 'thermometer-outline',
        color: 'text-sky-400',
        bgColor: 'bg-sky-950/20',
        borderColor: 'border-sky-900/30',
        explanation: 'Skin thermoregulation is stable, confirming absence of systemic heat or inflammatory Pitta spike.'
      });
    }

    // Node 4: Dosha Effect
    if (primaryImbalance === 'pitta') {
      list.push({
        id: 'dosha',
        label: 'Possible Pitta Increase',
        subLabel: 'Fire element accumulation',
        icon: 'flame-outline',
        color: 'text-orange-400',
        bgColor: 'bg-orange-950/20',
        borderColor: 'border-orange-900/30',
        explanation: 'Elevated pulses and warm thermals stimulate the fire (Pitta) element, which governs acidity and metabolic speed.'
      });
    } else if (primaryImbalance === 'vata') {
      list.push({
        id: 'dosha',
        label: 'Possible Vata Spike',
        subLabel: 'Air element disturbance',
        icon: 'cloud-outline',
        color: 'text-sky-400',
        bgColor: 'bg-sky-950/20',
        borderColor: 'border-sky-900/30',
        explanation: 'Sleep deficits and irregular HRV excite the Vata air force, leading to dryness and rapid nervous impulses.'
      });
    } else if (primaryImbalance === 'kapha') {
      list.push({
        id: 'dosha',
        label: 'Possible Kapha Excess',
        subLabel: 'Earth element stagnation',
        icon: 'body-outline',
        color: 'text-teal-400',
        bgColor: 'bg-teal-950/20',
        borderColor: 'border-teal-900/30',
        explanation: 'Low step scores and low cardiovascular flow accumulate Kapha earth, which slows digestion and induces heaviness.'
      });
    } else {
      list.push({
        id: 'dosha',
        label: 'Balanced Tri-Dosha State',
        subLabel: 'Optimal Element Harmony',
        icon: 'sparkles-outline',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/20',
        borderColor: 'border-emerald-900/30',
        explanation: 'All three bio-forces (Vata, Pitta, Kapha) are maintaining their relative positions within your calibrated baseline ratios.'
      });
    }

    // Node 5: Symptom
    if (sleepScore > 0 && sleepScore < 70) {
      list.push({
        id: 'symptom',
        label: 'Slight Afternoon Fatigue',
        subLabel: 'Subjective feeling',
        icon: 'battery-dead-outline',
        color: 'text-amber-400',
        bgColor: 'bg-amber-950/20',
        borderColor: 'border-amber-900/30',
        explanation: 'Cellular recovery was restricted; expect a natural energy dip around 2:00 PM - 4:00 PM.'
      });
    } else if (primaryImbalance === 'pitta') {
      list.push({
        id: 'symptom',
        label: 'Mild Midday Acidity / Heat',
        subLabel: 'Thermal symptom',
        icon: 'sunny-outline',
        color: 'text-orange-400',
        bgColor: 'bg-orange-950/20',
        borderColor: 'border-orange-900/30',
        explanation: 'Elevated Pitta manifests as internal warmth, thirst, or mild acid reflux if cooling foods are not consumed.'
      });
    } else if (primaryImbalance === 'vata') {
      list.push({
        id: 'symptom',
        label: 'Racing Thoughts / Dryness',
        subLabel: 'Nervous symptom',
        icon: 'alert-circle-outline',
        color: 'text-sky-400',
        bgColor: 'bg-sky-950/20',
        borderColor: 'border-sky-900/30',
        explanation: 'Excess wind makes the nervous system highly sensitive, causing dry lips and racing thoughts.'
      });
    } else {
      list.push({
        id: 'symptom',
        label: 'High Alertness & Vitality',
        subLabel: 'Ojas shield active',
        icon: 'happy-outline',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/20',
        borderColor: 'border-emerald-900/30',
        explanation: 'A balanced body produces ample Ojas, manifesting as bright mental clarity and strong physical endurance.'
      });
    }

    // Node 6: Recommendation
    if (primaryImbalance === 'pitta') {
      list.push({
        id: 'action',
        label: 'Cooling Lunch & Shady Walk',
        subLabel: 'Pitta-pacifying strategy',
        icon: 'beer-outline', // Coconut water representation
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/25',
        borderColor: 'border-emerald-500/30',
        explanation: 'Drink fresh coconut water, enjoy a cucumber/mint salad, and avoid exercising under direct afternoon sunlight.'
      });
    } else if (primaryImbalance === 'vata') {
      list.push({
        id: 'action',
        label: 'Warm Soup & Quiet Evening',
        subLabel: 'Vata-grounding strategy',
        icon: 'restaurant-outline',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/25',
        borderColor: 'border-emerald-500/30',
        explanation: 'Eat warm, oily, easily digestible soups (like Mung Dal) and wind down without screens by 9:30 PM.'
      });
    } else {
      list.push({
        id: 'action',
        label: 'Cardio Movement & Ginger Tea',
        subLabel: 'Kapha-invigorating strategy',
        icon: 'walk-outline',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/25',
        borderColor: 'border-emerald-500/30',
        explanation: 'Ignite your metabolic fire with 20 minutes of active walking or jogging, and drink warm ginger tea after meals.'
      });
    }

    return list;
  }, [date, dosha, hr, sleepScore, steps, primaryImbalance]);

  // Node fade-in animations list
  const anims = useRef(nodes.map(() => new Animated.Value(0))).current;

  // Re-trigger animation when date changes
  useEffect(() => {
    // Reset all anims
    anims.forEach(anim => anim.setValue(0));
    setActiveNodeId(null);

    // Stagger fade-in
    Animated.stagger(
      150,
      anims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        })
      )
    ).start();
  }, [date]);

  const handleNodePress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveNodeId(prev => (prev === id ? null : id));
  };

  return (
    <View className="py-4">
      {nodes.map((node, idx) => {
        const isActive = activeNodeId === node.id;
        const isLast = idx === nodes.length - 1;

        return (
          <View key={node.id} className="items-center w-full">
            
            {/* Animated Node Card Container */}
            <Animated.View
              style={{
                opacity: anims[idx] || 1,
                transform: [
                  {
                    translateY: (anims[idx] || new Animated.Value(1)).interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0]
                    })
                  }
                ],
                width: '100%'
              }}
            >
              <TouchableOpacity
                onPress={() => handleNodePress(node.id)}
                className={`border p-4.5 rounded-2xl flex-row items-center justify-between ${
                  isActive ? 'bg-[#172722]/70 border-emerald-500/35' : `${node.bgColor} ${node.borderColor}`
                }`}
              >
                <View className="flex-row items-center flex-1 mr-4">
                  <View className="w-9 h-9 rounded-xl bg-[#091310] border border-[#1f372f]/40 justify-center items-center mr-3.5">
                    <Ionicons name={node.icon as any} size={16} color={isActive ? '#34d399' : '#10b981'} />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-xs font-serif font-black ${node.color}`}>{node.label}</Text>
                    <Text className="text-slate-400 text-[8px] uppercase tracking-wider font-mono mt-0.5">{node.subLabel}</Text>
                  </View>
                </View>
                <Ionicons 
                  name={isActive ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  color={isActive ? '#34d399' : '#4b5563'} 
                />
              </TouchableOpacity>

              {/* Expandable Explanation Details */}
              {isActive && (
                <Animated.View className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-xl mt-1.5 mb-2.5 mx-1">
                  <Text className="text-emerald-400 text-[8.5px] uppercase font-bold tracking-wider font-mono mb-1">Intelligence Breakdown</Text>
                  <Text className="text-slate-300 text-[11px] leading-relaxed font-sans">{node.explanation}</Text>
                </Animated.View>
              )}
            </Animated.View>

            {/* Connecting Arrow element */}
            {!isLast && (
              <Animated.View 
                style={{ opacity: anims[idx] || 1 }} 
                className="py-2.5 items-center justify-center"
              >
                <Ionicons name="arrow-down" size={14} color="#1f372f" />
              </Animated.View>
            )}

          </View>
        );
      })}
    </View>
  );
}
