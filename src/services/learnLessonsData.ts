export interface LessonSlide {
  title: string;
  content: string;
  analogyTitle?: string;
  analogy?: string;
  illustrationType: 'intro' | 'doshas' | 'vata' | 'pitta' | 'kapha' | 'agni' | 'ojas' | 'dinacharya' | 'ritucharya' | 'sensors';
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  estimatedTime: string;
  xpReward: number;
  color: string; // Tailwind hex gradient start
  icon: string; // Ionicons icon name
  slides: LessonSlide[];
  vitalsConnection: {
    title: string;
    desc: string;
    metricType: 'hr' | 'temp' | 'steps' | 'general';
  };
  quiz: QuizQuestion;
}

export const lessonsData: Lesson[] = [
  {
    id: 'intro',
    title: 'What is Ayurveda?',
    subtitle: 'Learn the foundational science of life',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#059669', // Emerald
    icon: 'leaf-outline',
    slides: [
      {
        title: 'The Science of Life',
        content: 'Ayurveda comes from the Sanskrit words "Ayur" (Life) and "Veda" (Knowledge). It is a 5,000-year-old system of natural healing that focuses on balance rather than treating symptoms.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Think of your body like a garden. Rather than just taping leaves back on a drying plant, Ayurveda nurtures the soil and waters the roots to keep the whole garden blooming.',
        illustrationType: 'intro'
      },
      {
        title: 'Dynamic Balance',
        content: 'In Ayurveda, health is not a static state. It is a continuous, dynamic balance between your body, mind, and the environment. When the elements are aligned, you feel active, calm, and vital.',
        illustrationType: 'intro'
      }
    ],
    vitalsConnection: {
      title: 'Connecting Your Vitals',
      desc: 'The heart rate and skin temperature synced from your wearable device reflect your current state of dynamic balance in real-time.',
      metricType: 'general'
    },
    quiz: {
      question: 'What does the word "Ayurveda" translate to?',
      options: [
        'The Study of Medicine',
        'The Science of Life',
        'The Art of Dieting',
        'Mental Peace'
      ],
      correctIndex: 1,
      explanation: 'Ayur translates to life, and Veda translates to knowledge or science. Hence, Ayurveda is the "Science of Life".'
    }
  },
  {
    id: 'doshas',
    title: 'What are Doshas?',
    subtitle: 'Discover your unique energetic blueprint',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#0284c7', // Sky
    icon: 'body-outline',
    slides: [
      {
        title: 'The Three Bio-Energies',
        content: 'Everything in nature is made of five elements: space, air, fire, water, and earth. Inside your body, these combine into three active bio-energies (forces) called Doshas: Vata, Pitta, and Kapha.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Imagine building a house. Vata is the architect (motion), Pitta is the electrical grid (energy/heat), and Kapha is the bricks and cement (stability/structure). You need all three to stand.',
        illustrationType: 'doshas'
      },
      {
        title: 'Your Unique Constitution (Prakriti)',
        content: 'Everyone has all three Doshas, but in different ratios. Your dominant Dosha defines your physical strengths, temperament, and digestion. Staying healthy means keeping your unique ratio balanced.',
        illustrationType: 'doshas'
      }
    ],
    vitalsConnection: {
      title: 'Connecting Your Vitals',
      desc: 'AquaAyur calculates your real-time Vata, Pitta, and Kapha ratios by analyzing continuous biometrics like skin temperature and heart rate variability (HRV).',
      metricType: 'general'
    },
    quiz: {
      question: 'Which of the following is NOT one of the three Doshas?',
      options: [
        'Vata',
        'Pitta',
        'Agni',
        'Kapha'
      ],
      correctIndex: 2,
      explanation: 'Vata, Pitta, and Kapha are the three primary doṣas. Agni is the term used for metabolic digestive fire.'
    }
  },
  {
    id: 'vata',
    title: 'What is Vata?',
    subtitle: 'The energy of wind, movement, and creativity',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#06b6d4', // Cyan
    icon: 'cloud-outline',
    slides: [
      {
        title: 'The Wind Element',
        content: 'Vata represents the elements of Air and Space. It controls all movement in your body: your heartbeat, breathing, nervous signals, and blood circulation.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Vata is like the wind blowing through trees. When it is gentle, it brings cool freshness (creativity, quick thinking). When it is a storm, it leaves branches scattered (anxiety, dry skin, gas).',
        illustrationType: 'vata'
      },
      {
        title: 'Signs of Imbalance',
        content: 'When Vata spikes, you might experience dry skin, bloating, racing thoughts, cold extremities, or light, interrupted sleep. Grounding habits help calm this excess air.',
        illustrationType: 'vata'
      }
    ],
    vitalsConnection: {
      title: 'Circulation and Vata',
      desc: 'Variable heart rate patterns and sudden fluctuations in skin temperature are classic signs of Vata instability.',
      metricType: 'temp'
    },
    quiz: {
      question: 'Which elements combine to form the Vata energy?',
      options: [
        'Fire and Water',
        'Earth and Water',
        'Air and Space',
        'Fire and Earth'
      ],
      correctIndex: 2,
      explanation: 'Vata is composed of Air and Space (Ether), directing all movement and nerve conduction.'
    }
  },
  {
    id: 'pitta',
    title: 'What is Pitta?',
    subtitle: 'The energy of fire, digestion, and focus',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#ea580c', // Orange
    icon: 'flame-outline',
    slides: [
      {
        title: 'The Fire Element',
        content: 'Pitta represents Fire and Water. It controls all transformation in the body: digestion of meals, enzymatic activity, metabolism, body temperature, and critical focus.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Pitta is like a kitchen stove. You need it hot enough to cook your food (digest nutrients). But if the flame gets too high, it burns the house down (acid reflux, anger, red skin rashes).',
        illustrationType: 'pitta'
      },
      {
        title: 'Signs of Imbalance',
        content: 'Excess Pitta manifests as internal heat, acidity, skin inflammation, irritability, and sweating. Cooling foods (coconut water, cucumber) and moderate exercise calm Pitta.',
        illustrationType: 'pitta'
      }
    ],
    vitalsConnection: {
      title: 'Pulse & Pitta',
      desc: 'An elevated resting heart rate and warm skin temperatures can indicate high Pitta fire and metabolic intensity.',
      metricType: 'hr'
    },
    quiz: {
      question: 'What is the primary function of Pitta in the body?',
      options: [
        'Stability and lubrication',
        'Transformation and digestion',
        'Breathing and circulation',
        'Physical structure'
      ],
      correctIndex: 1,
      explanation: 'Pitta is fire-based and is primarily responsible for chemical transformation, digestion, and body temperature control.'
    }
  },
  {
    id: 'kapha',
    title: 'What is Kapha?',
    subtitle: 'The energy of structure, stability, and calm',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#14b8a6', // Teal
    icon: 'water-outline',
    slides: [
      {
        title: 'The Earth Element',
        content: 'Kapha represents Earth and Water. It forms the physical structure of your body: bones, muscles, joints, fluids, and holds the energy of calm resilience and immunity.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Kapha is like damp clay. When balanced, it holds beautiful shapes, providing strength and protection (steady stamina, loving patience). When wet and cold, it becomes heavy mud (congestion, sluggishness).',
        illustrationType: 'kapha'
      },
      {
        title: 'Signs of Imbalance',
        content: 'Elevated Kapha leads to lethargy, weight gain, sinus congestion, fluid retention, and mental attachment. Spices and cardiovascular movement ignite and clear Kapha.',
        illustrationType: 'kapha'
      }
    ],
    vitalsConnection: {
      title: 'Steps & Kapha Flow',
      desc: 'Your steps today help stimulate circulation, clearing out heavy Kapha earth stagnation and lifting vitality.',
      metricType: 'steps'
    },
    quiz: {
      question: 'How do you balance excess heavy Kapha in the system?',
      options: [
        'Taking a long nap',
        'Eating heavy desserts',
        'Brisk exercise and warming spices',
        'Staying inside a cold room'
      ],
      correctIndex: 2,
      explanation: 'Because Kapha is heavy, cold, and slow, it is balanced by its opposites: warm spices, light foods, and active, stimulating exercise.'
    }
  },
  {
    id: 'agni',
    title: 'What is Agni?',
    subtitle: 'Your core metabolic digestive fire',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#fbbf24', // Amber
    icon: 'analytics-outline',
    slides: [
      {
        title: 'The Engine of Health',
        content: 'Agni is your digestive fire. It determines how well you break down foods, absorb nutrients, and filter out wastes. Healthy Agni is key to a robust immune system.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Think of Agni like a campfire. If you dump heavy logs (heavy meals) on a tiny flame, it smothers it. If you throw dry twigs (light spiced foods) at regular times, the fire burns clean and hot.',
        illustrationType: 'agni'
      },
      {
        title: 'Types of Fire states',
        content: 'Agni can be Mandagni (sluggish/slow), Tikshnagni (sharp/acidic), Vishamagni (irregular/bloated), or Samagni (perfectly balanced). Spaced meals support clean Agni.',
        illustrationType: 'agni'
      }
    ],
    vitalsConnection: {
      title: 'Vitals and Metabolism',
      desc: 'Syncing your hydration logs and maintaining consistent meal timings helps prevent irregular Agni fluctuations.',
      metricType: 'general'
    },
    quiz: {
      question: 'Why is healthy Agni (digestive fire) critical in Ayurveda?',
      options: [
        'It keeps the lungs clear',
        'It digests food and creates cellular energy',
        'It increases sleep requirements',
        'It cools down the body'
      ],
      correctIndex: 1,
      explanation: 'Agni is the primary metabolic force responsible for breaking down food, absorbing nutrients, and converting them to cellular energy (Prana).'
    }
  },
  {
    id: 'ojas',
    title: 'What is Ojas?',
    subtitle: 'Your cellular immune shield and vitality',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#8b5cf6', // Violet
    icon: 'shield-checkmark-outline',
    slides: [
      {
        title: 'The Vital Essence',
        content: 'Ojas is the end product of healthy digestion and balanced doṣas. It is your body’s natural defense shield, providing immunity, radiant skin, stable nerves, and high vitality.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Ojas is like honey. It takes thousands of flowers (nutrient-dense foods) and steady processing (digestion) to distill a drop of pure, sweet honey (immune reserves).',
        illustrationType: 'ojas'
      },
      {
        title: 'Preserving Ojas',
        content: 'Ojas is depleted by chronic stress, excessive talking, rushing, and poor sleep. It is replenished by deep sleep, ghee, almonds, dates, and calming routines.',
        illustrationType: 'ojas'
      }
    ],
    vitalsConnection: {
      title: 'Restoring Ojas Shield',
      desc: 'High heart rate variability (HRV) and long deep sleep cycles are physiological indicators that your Ojas immune shield is rebuilding.',
      metricType: 'hr'
    },
    quiz: {
      question: 'Which of the following depletes your body’s Ojas reserves?',
      options: [
        'Chronic stress and sleep loss',
        'Eating almonds and ghee',
        'Meditation and deep breathing',
        'Drinking warm water'
      ],
      correctIndex: 0,
      explanation: 'Ojas is your vital energy reserve. It is depleted by stress, anxiety, overexertion, and lack of restorative sleep.'
    }
  },
  {
    id: 'dinacharya',
    title: 'What is Dinacharya?',
    subtitle: 'Aligning with circadian solar rhythms',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#f59e0b', // Amber-600
    icon: 'sunny-outline',
    slides: [
      {
        title: 'The Daily Circle',
        content: 'Dinacharya means "daily routine." It is the practice of aligning your eating, sleeping, and exercise routines with the natural circadian cycles of the sun.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Dinacharya is like rowing with the current. By waking before sunrise and eating your largest meal at noon (when the sun and your Agni are highest), your body operates with maximum ease.',
        illustrationType: 'dinacharya'
      },
      {
        title: 'The Circadian Segments',
        content: 'The day is split into 4-hour blocks ruled by different Doshas. 6:00 AM - 10:00 AM is Kapha (heavy, good for exercise). 10:00 AM - 2:00 PM is Pitta (high Agni, best for main lunch meal).',
        illustrationType: 'dinacharya'
      }
    ],
    vitalsConnection: {
      title: 'Vitals and Rhythms',
      desc: 'Logging your water and habits at the same hour daily helps anchor your autonomic nervous system rhythm.',
      metricType: 'general'
    },
    quiz: {
      question: 'At what time of day is your digestive fire (Agni) naturally at its peak?',
      options: [
        'At sunrise (6:00 AM)',
        'Midday / Solar Noon (12:00 PM - 1:30 PM)',
        'Late evening (8:00 PM)',
        'Midnight'
      ],
      correctIndex: 1,
      explanation: 'Because our inner fire (Agni) mirrors the sun, our digestive capacity peaks when the sun is highest in the sky (midday).'
    }
  },
  {
    id: 'ritucharya',
    title: 'What is Ritucharya?',
    subtitle: 'Adapting to seasonal shifts',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#10b981', // Emerald-500
    icon: 'calendar-outline',
    slides: [
      {
        title: 'The Seasonal Path',
        content: 'Ritucharya means "seasonal routine." As seasons change, the dominant elements in nature shift (e.g. Vata dry air in autumn, Pitta hot fire in summer). We must adjust our habits to match.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'You wouldn’t wear a heavy wool coat in mid-summer or drink iced water in a snowstorm. Ritucharya is adjusting your diet and routine so you stay balanced as the seasons turn.',
        illustrationType: 'ritucharya'
      },
      {
        title: 'Seasonal Guidelines',
        content: 'In cold winter, eat warm nourishing soup to protect Agni. In hot summer, choose sweet, cooling fruits. In spring, eat lighter foods to clear out congested winter Kapha accumulation.',
        illustrationType: 'ritucharya'
      }
    ],
    vitalsConnection: {
      title: 'Seasonal Skin Temperature',
      desc: 'Our skin thermoregulation adaptively shifts with seasons; tracking these deviations helps identify thermal stress.',
      metricType: 'temp'
    },
    quiz: {
      question: 'What diet adjustment is recommended during cold winter seasons?',
      options: [
        'Drinking iced juices',
        'Consuming light raw salads',
        'Warm, nourishing, cooked soups and foods',
        'Skipping meals entirely'
      ],
      correctIndex: 2,
      explanation: 'In winter, external cold suppresses internal Agni if unprotected. Warm, cooked, slightly oily foods protect Agni and calm dry Vata.'
    }
  },
  {
    id: 'sensors',
    title: 'How does AquaAyur work?',
    subtitle: 'Decoding your physical biometric metrics',
    estimatedTime: '2 mins',
    xpReward: 30,
    color: '#6366f1', // Indigo
    icon: 'hardware-chip-outline',
    slides: [
      {
        title: 'GATT Vitals Mapping',
        content: 'Your physical ESP32 wearable streams 3 key sensors over Bluetooth: Optical Pulse (PPG), Skin Temperature Thermistor, and Accelerometer Motion.',
        analogyTitle: 'Real-Life Analogy',
        analogy: 'Like an ancient Ayurvedic physician reading your wrist pulse (Nadi Pariksha) to feel thermal qualities and rhythm, AquaAyur reads digital heart rate variability and temperature.',
        illustrationType: 'sensors'
      },
      {
        title: 'The Estimation Algorithm',
        content: 'Heart rate variations map nervous balance (Vata wind). Body skin temperature maps metabolic heat (Pitta fire). Daily step movement patterns map physical stability (Kapha earth).',
        illustrationType: 'sensors'
      }
    ],
    vitalsConnection: {
      title: 'Hardware Connection',
      desc: 'Keeping your sensor band connected allows the system to build accurate weekly trends.',
      metricType: 'general'
    },
    quiz: {
      question: 'How does AquaAyur estimate Vata (Air element) levels?',
      options: [
        'By counting your daily step totals',
        'By reading your skin temperature deviations',
        'By tracking heart rate rhythms and variability (HRV)',
        'By analyzing water log totals'
      ],
      correctIndex: 2,
      explanation: 'Vata rules the nervous system and heartbeat. Rhythmic variations in your heart rate (HRV) are analyzed to calculate Vata fluctuations.'
    }
  }
];
