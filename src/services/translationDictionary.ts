export interface TranslationPayload {
  whatIsHappening: string;
  why: string;
  whatTodo: string;
  whatNextDay: string;
}

export type LocaleType = 'en' | 'sa';

export interface DictionarySchema {
  doshas: {
    vata: {
      high: TranslationPayload;
      balanced: TranslationPayload;
    };
    pitta: {
      high: TranslationPayload;
      balanced: TranslationPayload;
    };
    kapha: {
      high: TranslationPayload;
      balanced: TranslationPayload;
    };
    balanced: TranslationPayload;
  };
  agni: {
    slow: { label: string; desc: string };
    steady: { label: string; desc: string };
    strong: { label: string; desc: string };
  };
  ojas: {
    recovery: { label: string; desc: string };
    resilient: { label: string; desc: string };
  };
  vitals: {
    heartRate: {
      slow: string;
      steady: string;
      active: string;
    };
    temperature: {
      cool: string;
      balanced: string;
      warm: string;
    };
    movement: {
      sedentary: string;
      relaxed: string;
      active: string;
    };
  };
}

export const translationDictionary: Record<LocaleType, DictionarySchema> = {
  en: {
    doshas: {
      vata: {
        high: {
          whatIsHappening: "Your body and mind may feel slightly scattered, sensitive, or restless today.",
          why: "Vata (Air & Ether) elements are elevated, driven by irregular routines, stress, or light sleep.",
          whatTodo: "Prioritize warm, freshly cooked foods, sip warm herbal infusions, and take a 5-minute slow breathing break.",
          whatNextDay: "Grounding your routines today will stabilize your nervous system and support deep, restorative sleep tonight."
        },
        balanced: {
          whatIsHappening: "Your Vata energy is flowing smoothly, supporting clear thoughts and creative adaptability.",
          why: "Your nervous system is operating in a calm, balanced state with steady circadian alignment.",
          whatTodo: "Maintain your regular schedule, avoid sudden changes in routine, and keep warm.",
          whatNextDay: "Continuing this steady flow will ensure sustained mental clarity and cognitive agility tomorrow."
        }
      },
      pitta: {
        high: {
          whatIsHappening: "Your body may be generating more internal warmth, intensity, or sensitivity today.",
          why: "Pitta (Fire & Water) fire elements are elevated, triggered by intense activity, hot weather, or stimulating foods.",
          whatTodo: "Cool and calm your system. Enjoy sweet cooling fruits, drink coconut water, and take a shaded walk.",
          whatNextDay: "Pacifying your internal heat today will prevent midday digestive acidity and keep your sleep onset peaceful."
        },
        balanced: {
          whatIsHappening: "Your Pitta fire is burning bright and clear, supporting strong focus and sharp understanding.",
          why: "Your metabolic fire is well-balanced, indicating optimal circulation and comfortable body warmth.",
          whatTodo: "Incorporate moderate seasonings in meals, enjoy creative projects, and maintain physical cooling.",
          whatNextDay: "Sustaining this balance preserves sharp analytical focus and steady daytime vitality tomorrow."
        }
      },
      kapha: {
        high: {
          whatIsHappening: "Your system may feel heavier, slow-paced, or less energetic today.",
          why: "Kapha (Earth & Water) elements are elevated, accumulated from physical rest, heavy foods, or sluggish circulation.",
          whatTodo: "Ignite your vitality. Stimulate circulation with brisk movement and drink warm water infused with fresh ginger.",
          whatNextDay: "Activating your body today will clear sluggishness, lift mental fog, and bring back a clean energy flow by tomorrow."
        },
        balanced: {
          whatIsHappening: "Your Kapha energy is stable, providing deep structural strength and calm emotional resilience.",
          why: "Your physical tissues are well-nourished and circulation is working steadily.",
          whatTodo: "Enjoy moderate physical activity, consume warm spices, and practice daily active movement.",
          whatNextDay: "Maintaining this steady foundation will build a strong immune defense and steady energy for tomorrow."
        }
      },
      balanced: {
        whatIsHappening: "Your inner elements are in a beautiful state of harmony and calm balance today.",
        why: "Your Vata, Pitta, and Kapha elements are distributed evenly, indicating consistent routines and stable vital signs.",
        whatTodo: "Sustain this equilibrium. Continue your healthy nutrition, keep hydrated, and enjoy this steady state of well-being.",
        whatNextDay: "Maintaining this state will build deep vitality reserves, preparing you for a week of clear focus and high resilience."
      }
    },
    agni: {
      slow: {
        label: "Slower Digestive Fire",
        desc: "Your digestion may be slightly slower or more sensitive today. Your metabolic fire (Agni) is gentle."
      },
      steady: {
        label: "Steady Digestive Fire",
        desc: "Your digestion is balanced, functioning steadily to nourish your body without overheating."
      },
      strong: {
        label: "Strong Digestive Fire",
        desc: "Your digestion is highly active and efficient. Your metabolic fire (Agni) is clean and intense."
      }
    },
    ojas: {
      recovery: {
        label: "Recovery Mode",
        desc: "Your body's vital immune reserves are running lower. You may need additional rest and tissue recovery today."
      },
      resilient: {
        label: "Resilient Immunity",
        desc: "Your body's protective shield (Ojas) is strong and resilient. You have great natural defense and cellular vitality today."
      }
    },
    vitals: {
      heartRate: {
        slow: "Deep & Slow resting pulse",
        steady: "Steady & Calm pulse",
        active: "Active fire pulse"
      },
      temperature: {
        cool: "Cool skin",
        balanced: "Balanced temperature",
        warm: "Warm skin"
      },
      movement: {
        sedentary: "Resting",
        relaxed: "Relaxed walk",
        active: "Active pace"
      }
    }
  },
  sa: {
    doshas: {
      vata: {
        high: {
          whatIsHappening: "Adya vāta prakopaḥ: Tava śarīraṁ manaśca cañcalam asvasthaṁ ca bhāvyate.",
          why: "Aniyamita caryāyāḥ vāta doṣaḥ (Vāyuḥ Ākāśaśca) pradhāno jātaḥ.",
          whatTodo: "Uṣṇaṁ snigdhaṁ ca bhojanaṁ svīkuru, uṣṇajalam piba, śanaiḥ prāṇāyāmaṁ kuru.",
          whatNextDay: "Adya sthiratāyāṁ kṛtāyāṁ tava tantrikā-tantraṁ svāsthyaṁ prāpsyati, rātrau nidrā ca sukhadā bhaviṣyati."
        },
        balanced: {
          whatIsHappening: "Vāto niyamita-gatiḥ pratyakṣyate, manaḥ sṛjanātmakaṁ prasanṇaṁ ca asti.",
          why: "Nāḍī-tantraṁ śāntam asti, dinacaryā-niyamaḥ samyak pālyate.",
          whatTodo: "Samaye dinacaryāṁ pālayata, śīta-vāyutaḥ rakṣaṇaṁ kuru.",
          whatNextDay: "Anena tava mānasika-śaktiḥ buddhi-vaimalyaṁ ca śvaḥ api rakṣitaṁ bhaviṣyati."
        }
      },
      pitta: {
        high: {
          whatIsHappening: "Adya pitta-prakopaḥ: Tava śarīre uṣṇatā, tīvratā, saṁvedanaśīlatā ca adhi-bhavati.",
          why: "Ugra-kāryaiḥ, atyuṣṇa-vātāvaraṇena vā pitta doṣaḥ (Agniḥ Jalaṁca) pravṛddhaḥ.",
          whatTodo: "Śītalī-kuru śarīram. Madhura-śītala-phalāni khāda, nārikela-jalam piba, chāyāyāṁ vihara.",
          whatNextDay: "Uṣṇatā-shamane kṛte tava madhyāhne amlatā na bhaviṣyati, śvaḥ nidrā api śāntā bhaviṣyati."
        },
        balanced: {
          whatIsHappening: "Pitta doṣaḥ sama-sthitau asti, ekāgratā tīkṣṇa-buddhiśca prāpyate.",
          why: "Metabolic Agniḥ samyak jvalati, śarīrasya dhātavaḥ svāsthyena sañcalanti.",
          whatTodo: "Mitam uṣṇa-vyañjanaṁ khāda, sṛjanātmaka-kāryeṣu manaḥ yoja.",
          whatNextDay: "Anena śvaḥ api tava kāryakṣamatā tīkṣṇatā ca samyak sthāsyati."
        }
      },
      kapha: {
        high: {
          whatIsHappening: "Adya kapha-prakopaḥ: Tava śarīraṁ bhāri, manda-gati, mandotsāhaṁ ca dṛśyate.",
          why: "Pracura-viśrāmeṇa, gurutara-bhojanena vā kapha doṣaḥ (Pṛthivī Jalaṁca) pravṛddhaḥ.",
          whatTodo: "Caitanyaṁ jāgraya. Prātar-bhramaṇaṁ kuru, ārdraka-uṣṇajalam piba.",
          whatNextDay: "Kriyāśīlatayā kaphasya mandam apasariṣyati, mānasika-prasādasya śvaḥ udayo bhaviṣyati."
        },
        balanced: {
          whatIsHappening: "Kapho dhairya-sthairya-balaṁ dadāti, mānasika-saṁyamaḥ ca dṛḍho'sti.",
          why: "Śarīra-dhātavaḥ puṣṭāḥ santi, śoṇita-sañcāraḥ sama-gatyā sañcalati.",
          whatTodo: "Vyāyāmaṁ kuru, uṣṇa-kaṭu-bhojanaṁ svīkuru, kriyāśīlo bhava.",
          whatNextDay: "Imāṁ sthiratāṁ sthāpayitvā śvaḥ tava vyādhi-kṣamatvaṁ śarīra-balaṁ ca sudṛḍhaṁ bhaviṣyati."
        }
      },
      balanced: {
        whatIsHappening: "Sarve doṣāḥ sama-sthitau santi, śarīre svasthatā prasanṇatā ca rājate.",
        why: "Vāta-pitta-kaphāḥ samatvam āpannāḥ, dinacaryā yuktā asti.",
        whatTodo: "Imāṁ samasthitiṁ pālayitum svastha-bhojanaṁ kuru, niyamitavāri-pānaṁ kuru.",
        whatNextDay: "Anena śvaḥ api tava prāṇa-śaktiḥ dṛḍhā bhaviṣyati, kāryakṣamatā ca vardhiṣyate."
      }
    },
    agni: {
      slow: {
        label: "Mandāgni (Manda)",
        desc: "Jāṭharāgniḥ manda-bhāve jvalati. Adya tava pācana-kriyā mandā saṁvedanaśīlā ca asti."
      },
      steady: {
        label: "Samāgni (Sama)",
        desc: "Jāṭharāgniḥ sama-sthitau asti. Bhojanaṁ samyak pacyate śarīrasya puṣṭiḥ ca satataṁ bhavati."
      },
      strong: {
        label: "Tīkṣṇāgni (Tīkṣṇa)",
        desc: "Jāṭharāgniḥ tīvra-bhāve jvalati. Bhojana-pācanaṁ śīghraṁ bhavati, kṣudhā ca tīvrā asti."
      }
    },
    ojas: {
      recovery: {
        label: "Ojo-kṣayaḥ (Ojas Recharging)",
        desc: "Tava śarīrasya vyādhi-rodhaka-śaktiḥ kṣīṇā asti. Adya pracura-viśrāmasya puṣṭi-kāraka-bhojanasya ca āvaśyakatā asti."
      },
      resilient: {
        label: "Ojo-vṛddhiḥ (Ojas Resilient)",
        desc: "Tava ojo-balaṁ sudṛḍham asti. Śarīrasya pratikāra-śaktiḥ dhātu-balaṁ ca prabalatamam asti."
      }
    },
    vitals: {
      heartRate: {
        slow: "Prāṇaḥ gambhīra-manda-gatiḥ",
        steady: "Prāṇaḥ sama-śānta-gatiḥ",
        active: "Tejaḥ uṣṇa-pulse-gatiḥ"
      },
      temperature: {
        cool: "Sama-śītala-tvak",
        balanced: "Sama-toṣṇa-tvak",
        warm: "Uṣṇa-metabolic-tvak"
      },
      movement: {
        sedentary: "Dhyāna-viśrāmaḥ",
        relaxed: "Sama-bhramaṇam",
        active: "Active vyāyāmaḥ"
      }
    }
  }
};
