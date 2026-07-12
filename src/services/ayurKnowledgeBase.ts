export interface FoodRecord {
  name: string;
  category: 'fruit' | 'vegetable' | 'grain' | 'spice' | 'dairy' | 'legume' | 'fat';
  tastes: string[]; // sweet, sour, salty, bitter, pungent, astringent
  pacifies: ('vata' | 'pitta' | 'kapha')[];
  aggravates: ('vata' | 'pitta' | 'kapha')[];
  attributes: string[]; // hot, cold, heavy, light, dry, oily
  ayurvedicAction: string;
}

export interface HerbRecord {
  name: string;
  targetDosha: 'Vata' | 'Pitta' | 'Kapha' | 'Tridoshic';
  action: string;
  indications: string[];
  preparation: string;
}

export interface DinacharyaRoutine {
  activity: string;
  timePeriod: 'dawn' | 'morning' | 'midday' | 'evening' | 'night';
  description: string;
  benefit: string;
  doshaImpact: string;
}

export interface RitucharyaGuideline {
  seasonName: 'Vasanta' | 'Grishma' | 'Varsha' | 'Sharad' | 'Hemanta' | 'Shishira';
  englishTranslation: string;
  months: string[];
  dietaryDirectives: string[];
  lifestyleDirectives: string[];
}

export interface DoshaRule {
  dosha: 'vata' | 'pitta' | 'kapha';
  aggravationIndicators: string[];
  balancingDirectives: string[];
  bestSpices: string[];
}

export interface AgniRule {
  classification: 'mandagni' | 'tikshnagni' | 'vishamagni' | 'samagni';
  englishLabel: string;
  indicators: string[];
  correctiveActions: string[];
}

export interface OjasRule {
  classification: 'depleted' | 'conserved';
  indicators: string[];
  rejuvenationTherapies: string[];
}

/**
 * Static Verified Ayurvedic Knowledge Base
 */
export const AYURVEDIC_KNOWLEDGE_BASE = {
  foods: [
    { name: 'Warm water with ginger', category: 'fat', tastes: ['pungent'], pacifies: ['vata', 'kapha'], aggravates: ['pitta'], attributes: ['hot', 'light'], ayurvedicAction: 'Kindles Agni metabolism, scrapes toxins (Ama).' },
    { name: 'Pure Organic Ghee', category: 'fat', tastes: ['sweet'], pacifies: ['vata', 'pitta'], aggravates: ['kapha'], attributes: ['cold', 'oily', 'heavy'], ayurvedicAction: 'Directly builds Ojas vitality, lubricates tissues, stabilizes Vata wind.' },
    { name: 'Cooked Mung Dal', category: 'legume', tastes: ['sweet', 'astringent'], pacifies: ['vata', 'pitta', 'kapha'], aggravates: [], attributes: ['cold', 'light'], ayurvedicAction: 'Highly digestible protein, balancing to all three doshas (Tridoshic).' },
    { name: 'Sweet Almonds (soaked and peeled)', category: 'fat', tastes: ['sweet'], pacifies: ['vata'], aggravates: ['pitta', 'kapha'], attributes: ['hot', 'oily', 'heavy'], ayurvedicAction: 'Nourishes brain tissue, builds Ojas immunity.' },
    { name: 'Fennel Tea', category: 'spice', tastes: ['sweet', 'pungent'], pacifies: ['vata', 'pitta', 'kapha'], aggravates: [], attributes: ['slightly warm', 'light'], ayurvedicAction: 'Relieves intestinal gas, strengthens Agni without increasing Pitta heat.' },
    { name: 'Pomegranate Juice', category: 'fruit', tastes: ['sweet', 'sour', 'astringent'], pacifies: ['pitta', 'kapha'], aggravates: ['vata'], attributes: ['cold', 'light'], ayurvedicAction: 'Purifies blood plasma, cools inflammatory Pitta heat.' },
    { name: 'Basmati Rice', category: 'grain', tastes: ['sweet'], pacifies: ['vata', 'pitta'], aggravates: ['kapha'], attributes: ['cold', 'heavy'], ayurvedicAction: 'Provides cooling energy, grounding to erratic Vata nervous system.' }
  ] as FoodRecord[],

  herbs: [
    { name: 'Ashwagandha', targetDosha: 'Vata', action: 'Rasayana (rejuvenator), calms nervous system.', indications: ['Fatigue', 'Insomnia', 'High Stress', 'Vata stiffness'], preparation: '1/2 teaspoon in warm milk before sleep.' },
    { name: 'Shatavari', targetDosha: 'Pitta', action: 'Cooling rejuvenator, supports mucosal lining.', indications: ['Acidity', 'Dehydration', 'Inflammation', 'Pitta heat'], preparation: '1/2 teaspoon in warm ghee or water.' },
    { name: 'Triphala', targetDosha: 'Tridoshic', action: 'Tonic, mild laxative, cleanses digestives.', indications: ['Sluggish Agni', 'Constipation', 'Toxin accumulation'], preparation: '1/2 teaspoon in warm water before bedtime.' },
    { name: 'Ginger', targetDosha: 'Kapha', action: 'Stimulates appetite, clears cold stagnation.', indications: ['Mandagni', 'Congestion', 'Lethargy', 'Kapha mucus'], preparation: 'Fresh infusion before meals.' }
  ] as HerbRecord[],

  dinacharya: [
    { activity: 'Ushapan', timePeriod: 'dawn', description: 'Drinking 500ml warm water at dawn.', benefit: 'Flushes out colon Ama, wakes up peristalsis.', doshaImpact: 'Pacifies Vata dryness.' },
    { activity: 'Jihwa Nirlekhana', timePeriod: 'morning', description: 'Tongue scraping with copper scraper.', benefit: 'Removes overnight oral Ama coating, stimulates digestion.', doshaImpact: 'Clears Kapha residue.' },
    { activity: 'Abhyanga', timePeriod: 'morning', description: 'Self-massage with warm sesame oil.', benefit: 'Lubricates joints, calms nervous system, improves circulation.', doshaImpact: 'Strongly pacifies Vata wind.' },
    { activity: 'Vyayama', timePeriod: 'morning', description: 'Yoga or light exercise (under 50% capacity).', benefit: 'Increases structural flexibility, clears lethargy.', doshaImpact: 'Burns Kapha sluggishness.' },
    { activity: 'Nadi Shodhana', timePeriod: 'evening', description: 'Alternate nostril breathing exercises.', benefit: 'Balances brain hemispheres, lowers heart rate.', doshaImpact: 'Calms Vata anxiety.' }
  ] as DinacharyaRoutine[],

  ritucharya: [
    { seasonName: 'Grishma', englishTranslation: 'Summer', months: ['June', 'July'], dietaryDirectives: ['Avoid spicy, salty, or highly sour foods.', 'Drink cool water and sweet fruit juices.'], lifestyleDirectives: ['Avoid strenuous exercise during peak sun.', 'Apply sandalwood paste and sleep in well-ventilated spaces.'] },
    { seasonName: 'Sharad', englishTranslation: 'Autumn', months: ['October', 'November'], dietaryDirectives: ['Include ghee, mung dal, and bitter vegetables.', 'Avoid heavy fats and excessive alcohol.'], lifestyleDirectives: ['Take moon baths to cool residual summer heat.', 'Maintain gentle walks.'] },
    { seasonName: 'Hemanta', englishTranslation: 'Winter', months: ['December', 'January'], dietaryDirectives: ['Eat warm, spiced, nourishing soups.', 'Sweet, sour, and salty tastes are favored.'], lifestyleDirectives: ['Keep warm, exercise at higher intensity.', 'Abhyanga self-massage is essential daily.'] }
  ] as RitucharyaGuideline[],

  doshaRules: [
    {
      dosha: 'vata',
      aggravationIndicators: ['Constipation', 'Dry skin', 'Restlessness', 'Erratic heart rates', 'Cold limbs'],
      balancingDirectives: ['Eat warm, oily, cooked foods.', 'Favor sweet, sour, and salty tastes.', 'Strict daily sleep timings.'],
      bestSpices: ['Ginger', 'Cardamom', 'Cumin', 'Asafoetida']
    },
    {
      dosha: 'pitta',
      aggravationIndicators: ['Acidity', 'Skin rashes', 'Irritability', 'Excessive body heat', 'Inflammatory vitals'],
      balancingDirectives: ['Eat cool, sweet, dry foods.', 'Favor sweet, bitter, and astringent tastes.', 'Avoid peak noon sun.'],
      bestSpices: ['Fennel', 'Coriander', 'Mint', 'Turmeric']
    },
    {
      dosha: 'kapha',
      aggravationIndicators: ['Lethargy', 'Congestion', 'Excessive weight', 'Fluid retention', 'Sluggish pulse'],
      balancingDirectives: ['Eat light, warm, dry foods.', 'Favor pungent, bitter, and astringent tastes.', 'Perform daily aerobic movement.'],
      bestSpices: ['Black Pepper', 'Ginger', 'Mustard seed', 'Cinnamon']
    }
  ] as DoshaRule[],

  agniRules: [
    { classification: 'mandagni', englishLabel: 'Slow Digestion', indicators: ['Heavy stomach after light meals', 'Lethargy', 'Cold limbs', 'Kapha pulse'], correctiveActions: ['Drink hot ginger tea before eating.', 'Fast occasionally or eat light broths.', 'Avoid heavy dairy, cold food, and cold water.'] },
    { classification: 'tikshnagni', englishLabel: 'Sharp/Acidic Digestion', indicators: ['Burning sensations', 'Hyperacidity', 'Loose stools', 'Irritability', 'Pitta pulse'], correctiveActions: ['Cook meals with ghee and coconut oil.', 'Avoid chili pepper, vinegar, and tomatoes.', 'Drink fennel seed infusion cold.'] },
    { classification: 'vishamagni', englishLabel: 'Erratic Digestion', indicators: ['Intestinal gas', 'Bloating', 'Dry skin', 'Alternating constipation', 'Vata pulse'], correctiveActions: ['Maintain identical meal times daily.', 'Eat soft warm stews with cumin and hing.', 'Abhyanga body massage.'] },
    { classification: 'samagni', englishLabel: 'Balanced Digestion', indicators: ['Stable appetite', 'Clear tongue coating', 'Even energy levels', 'Normal elimination'], correctiveActions: ['Maintain current dietary habits.', 'Do not overeat or eat before previous meal is digested.'] }
  ] as AgniRule[],

  ojasRules: [
    { classification: 'depleted', indicators: ['Chronic fatigue', 'Muscle wasting', 'Frequent illness', 'Anxiety', 'Low heart rate variability'], rejuvenationTherapies: ['Drink almond-date ojas milk with ghee.', 'Incorporate Ashwagandha or Shatavari herbs.', 'Sleep 8 hours before 10 PM.'] },
    { classification: 'conserved', indicators: ['Clear complexion', 'Strong immunity', 'Mental peace', 'High energy', 'Stable vitals'], rejuvenationTherapies: ['Conserve energy via yoga.', 'Maintain regular dinacharya.'] }
  ] as OjasRule[]
};
