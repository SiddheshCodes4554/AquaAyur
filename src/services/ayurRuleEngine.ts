import { 
  AYURVEDIC_KNOWLEDGE_BASE, 
  FoodRecord, 
  HerbRecord, 
  DinacharyaRoutine, 
  DoshaRule, 
  AgniRule, 
  OjasRule, 
  RitucharyaGuideline 
} from './ayurKnowledgeBase';

export interface GroundedFacts {
  dominantDosha: 'Vata' | 'Pitta' | 'Kapha' | 'Balanced';
  vataPercentage: number;
  pittaPercentage: number;
  kaphaPercentage: number;
  agniState: 'mandagni' | 'tikshnagni' | 'vishamagni' | 'samagni';
  ojasState: 'depleted' | 'conserved';
  currentSeasonName: string;
  
  // Rules-grounded data subsets
  matchedFoods: FoodRecord[];
  matchedHerbs: HerbRecord[];
  recommendedRoutines: DinacharyaRoutine[];
  correctiveAgniActions: string[];
  rejuvenatingOjasTherapies: string[];
  doshaBalancingDirectives: string[];
  doshaBestSpices: string[];
  seasonalDietaryDirectives: string[];
}

/**
 * Executes the Rule Engine to generate a strictly grounded Ayurvedic facts context.
 */
export function evaluateAyurRules(
  doshaPercentages: { vata: number; pitta: number; kapha: number },
  agniScore: number,
  ojasScore: number,
  monthIndex: number = new Date().getMonth()
): GroundedFacts {
  
  // 1. EVALUATE DOMINANT DOSHA
  const vataVal = doshaPercentages.vata;
  const pittaVal = doshaPercentages.pitta;
  const kaphaVal = doshaPercentages.kapha;
  const maxVal = Math.max(vataVal, pittaVal, kaphaVal);

  let dominantDosha: 'Vata' | 'Pitta' | 'Kapha' | 'Balanced' = 'Balanced';
  if (maxVal > 38) {
    dominantDosha = maxVal === vataVal ? 'Vata' : maxVal === pittaVal ? 'Pitta' : 'Kapha';
  }

  // 2. EVALUATE AGNI STATE
  let agniState: 'mandagni' | 'tikshnagni' | 'vishamagni' | 'samagni' = 'samagni';
  if (agniScore < 65) {
    if (dominantDosha === 'Vata') agniState = 'vishamagni';
    else if (dominantDosha === 'Pitta') agniState = 'tikshnagni';
    else if (dominantDosha === 'Kapha') agniState = 'mandagni';
    else agniState = 'mandagni'; // default sluggish
  }

  // 3. EVALUATE OJAS STATE
  const ojasState: 'depleted' | 'conserved' = ojasScore < 72 ? 'depleted' : 'conserved';

  // 4. MAP SEASON RITUCHARYA (Vasanta/Spring, Grishma/Summer, Sharad/Autumn, Hemanta/Winter)
  let currentSeasonName: 'Grishma' | 'Sharad' | 'Hemanta' = 'Hemanta';
  if (monthIndex >= 5 && monthIndex <= 6) { // June, July
    currentSeasonName = 'Grishma';
  } else if (monthIndex >= 9 && monthIndex <= 10) { // Oct, Nov
    currentSeasonName = 'Sharad';
  }

  // 5. EXTRACT GROUNDED DATA SUBSETS FROM KNOWLEDGE BASE
  
  // Food grounding: Filter foods that pacify the dominant dosha, and exclude those that aggravate it
  let matchedFoods = AYURVEDIC_KNOWLEDGE_BASE.foods;
  if (dominantDosha !== 'Balanced') {
    const target = dominantDosha.toLowerCase() as 'vata' | 'pitta' | 'kapha';
    matchedFoods = AYURVEDIC_KNOWLEDGE_BASE.foods.filter(
      f => f.pacifies.includes(target) && !f.aggravates.includes(target)
    );
  }

  // Herbs grounding
  const matchedHerbs = AYURVEDIC_KNOWLEDGE_BASE.herbs.filter(
    h => h.targetDosha === dominantDosha || h.targetDosha === 'Tridoshic'
  );

  // Dinacharya routines: select 3 routines matching dosha/time
  const recommendedRoutines = AYURVEDIC_KNOWLEDGE_BASE.dinacharya.filter(d => {
    if (dominantDosha === 'Vata') return d.activity !== 'Jihwa Nirlekhana';
    if (dominantDosha === 'Kapha') return d.activity !== 'Abhyanga';
    return true;
  }).slice(0, 3);

  // Agni corrective actions
  const agniRule = AYURVEDIC_KNOWLEDGE_BASE.agniRules.find(a => a.classification === agniState);
  const correctiveAgniActions = agniRule ? agniRule.correctiveActions : [];

  // Ojas therapies
  const ojasRule = AYURVEDIC_KNOWLEDGE_BASE.ojasRules.find(o => o.classification === ojasState);
  const rejuvenatingOjasTherapies = ojasRule ? ojasRule.rejuvenationTherapies : [];

  // Dosha directives & spices
  const targetDoshaRule = AYURVEDIC_KNOWLEDGE_BASE.doshaRules.find(d => d.dosha === dominantDosha.toLowerCase());
  const doshaBalancingDirectives = targetDoshaRule ? targetDoshaRule.balancingDirectives : [];
  const doshaBestSpices = targetDoshaRule ? targetDoshaRule.bestSpices : [];

  // Seasonal directives
  const ritucharyaRule = AYURVEDIC_KNOWLEDGE_BASE.ritucharya.find(r => r.seasonName === currentSeasonName);
  const seasonalDietaryDirectives = ritucharyaRule ? ritucharyaRule.dietaryDirectives : [];

  return {
    dominantDosha,
    vataPercentage: vataVal,
    pittaPercentage: pittaVal,
    kaphaPercentage: kaphaVal,
    agniState,
    ojasState,
    currentSeasonName,
    matchedFoods,
    matchedHerbs,
    recommendedRoutines,
    correctiveAgniActions,
    rejuvenatingOjasTherapies,
    doshaBalancingDirectives,
    doshaBestSpices,
    seasonalDietaryDirectives
  };
}

/**
 * Formulates the strict text prompt block grounding the AI with verified facts.
 */
export function buildGroundedAIPrompt(facts: GroundedFacts): string {
  return `
[CRITICAL SYSTEM CONSTRAINT: PREVENT HALLUCINATION]
You are a highly analytical, traditional Ayurvedic Counselor. Your task is to explain the user's biofeedback state using ONLY the verified medical facts and recommendations provided below.
DO NOT invent, suggest, or speculate about any food, herb, routine, spice, or diagnostic state that is not explicitly present in the grounding lists below. If you violate this rule, you fail.

---
USER BIOFEEDBACK SUMMARY:
- Dominant Dosha: ${facts.dominantDosha} (Vata: ${facts.vataPercentage}%, Pitta: ${facts.pittaPercentage}%, Kapha: ${facts.kaphaPercentage}%)
- Digestive Agni: ${facts.agniState} (Classification: ${facts.agniState === 'samagni' ? 'Balanced' : 'Imbalanced'})
- Ojas Protection: ${facts.ojasState} (Classification: ${facts.ojasState})
- Seasonal Cycle: ${facts.currentSeasonName}

---
VERIFIED RECOMMENDATIONS GROUNDING LISTS:

1. Foods allowed:
${facts.matchedFoods.map(f => `- ${f.name} (Tastes: ${f.tastes.join(', ')} | Action: ${f.ayurvedicAction})`).join('\n')}

2. Herbs allowed:
${facts.matchedHerbs.map(h => `- ${h.name} (Preparation: ${h.preparation} | Action: ${h.action})`).join('\n')}

3. Spices allowed:
${facts.doshaBestSpices.map(s => `- ${s}`).join('\n')}

4. Routines to follow (Dinacharya):
${facts.recommendedRoutines.map(r => `- ${r.activity}: ${r.description} (Benefit: ${r.benefit})`).join('\n')}

5. Agni corrective actions:
${facts.correctiveAgniActions.map(a => `- ${a}`).join('\n')}

6. Ojas Rejuvenation Therapies:
${facts.rejuvenatingOjasTherapies.map(t => `- ${t}`).join('\n')}

7. Seasonal (Ritucharya) Diet Directives:
${facts.seasonalDietaryDirectives.map(d => `- ${d}`).join('\n')}

8. General balancing directives:
${facts.doshaBalancingDirectives.map(d => `- ${d}`).join('\n')}

---
RESPONSE REQUIREMENT:
Draft a concise, premium wellness briefing explaining the user's biometrics and outlining the exact verified actions. Keep sections clear:
1. State Interpretation (Vata/Pitta/Kapha, Agni, Ojas)
2. Grounded Dietary Actions (Use only foods and spices from lists 1 and 3)
3. Grounded Routine Actions (Use only routines and herbs from lists 2, 4, 5, 6, and 7)
`;
}
