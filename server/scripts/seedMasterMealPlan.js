#!/usr/bin/env node
// Idempotently seeds the shared "master" MealPlan from
// 14_day_vegetarian_meal_plan.improved.md. Safe to run multiple times: the
// single master plan with this name is upserted (description + days replaced).
//
// Usage:
//   node server/scripts/seedMasterMealPlan.js
//   node server/scripts/seedMasterMealPlan.js --dry-run
//
// Reads MONGODB_URI from server/.env.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const MealPlan = require('../models/MealPlan');

const PLAN_NAME = '14-Day Diverse Vegetarian (No Eggs)';

// Helper to keep the day blocks compact.
function meal(slot, name, foods, calories, protein, micros, notes = '') {
  return { slot, name, foods, calories, protein, micros, notes };
}

const DAYS = [
  // ---------- WEEK 1 ----------
  {
    dayIndex: 1, label: 'Day 1', totalCalories: 1910, totalProtein: 95,
    flag: 'low cal — add 1 fruit or +¼ cup rice at lunch to hit 2,000',
    meals: [
      meal('early_am',    'Almonds + walnuts',           'Soaked almonds (10) + walnuts (2)',                             130, 4,  'Vit E, omega-3, magnesium'),
      meal('breakfast',   'Whey + poha + banana',         'Whey (1 scoop) + milk (250ml) + vegetable poha (1 bowl) + banana (1)', 480, 32, 'Calcium, B12, potassium, complex carbs'),
      meal('mid_morning', 'Greek yogurt + chia',          'Greek yogurt (1 cup) + chia (1 tbsp)',                          180, 18, 'Probiotics, omega-3, calcium'),
      meal('lunch',       'Moong dal + rice + bhindi',    'Moong dal (1 cup) + brown rice (¾ cup) + bhindi sabzi (1 cup) + carrot-beet salad (1 cup, lemon)', 520, 16, 'Iron, folate, beta-carotene, fiber'),
      meal('snack',       'Roasted chana',                'Roasted chana (30g)',                                           120, 6,  'Fiber, iron'),
      meal('dinner',      'Tofu + sweet potato + spinach','Tofu stir-fry (100g) + sweet potato (1 medium, roasted) + sauteed spinach', 420, 16, 'Complete protein, vit A, potassium'),
      meal('bed',         'Buttermilk',                   'Buttermilk (1 glass)',                                          60,  3,  'Probiotics'),
    ],
  },
  {
    dayIndex: 2, label: 'Day 2', totalCalories: 1960, totalProtein: 98,
    meals: [
      meal('early_am',    'Walnuts + pumpkin seeds',      'Walnuts (4) + pumpkin seeds (1 tbsp)',                          150, 5,  'Omega-3, zinc, magnesium'),
      meal('breakfast',   'Whey + ragi porridge + apple', 'Whey + milk + ragi porridge (1 bowl) + apple (1)',              460, 31, 'Calcium (ragi), fiber, B12'),
      meal('mid_morning', 'Hung curd + flax',             'Hung curd (¾ cup) + flax (1 tbsp)',                             170, 15, 'Probiotics, omega-3'),
      meal('lunch',       'Masoor dal + jowar roti + lauki', 'Masoor dal (1 cup) + jowar roti (2) + lauki sabzi (1 cup) + beet-radish salad', 500, 15, 'Iron, fiber, antioxidants'),
      meal('snack',       'Sprouted moong chaat',         'Sprouted moong chaat (¾ cup, with tomato + lemon)',             140, 8,  'Vit C, enzymes, iron'),
      meal('dinner',      'Paneer bhurji + turnip + methi','Paneer bhurji (80g) + mashed turnip + methi sabzi',            420, 18, 'Calcium, vit K, protein'),
      meal('bed',         'Warm milk + turmeric',         'Warm milk + turmeric (1 cup)',                                  120, 6,  'Calcium, anti-inflammatory'),
    ],
  },
  {
    dayIndex: 3, label: 'Day 3', totalCalories: 1910, totalProtein: 102,
    flag: 'low cal — add 1 fruit or +¼ cup rice at lunch to hit 2,000',
    meals: [
      meal('early_am',    'Almonds + Brazil nut',         'Almonds (8) + Brazil nut (1)',                                  120, 4,  'Selenium, vit E'),
      meal('breakfast',   'Whey + besan chilla + orange', 'Whey + milk + besan chilla (2) + orange (1)',                   470, 33, 'Vit C, protein, B12'),
      meal('mid_morning', 'Greek yogurt + sunflower seeds','Greek yogurt (1 cup) + sunflower seeds (1 tbsp)',               190, 17, 'Probiotics, vit E'),
      meal('lunch',       'Toor dal + rice + carrot-peas','Toor dal (1 cup) + brown rice (¾ cup) + carrot-peas sabzi (1 cup) + cucumber salad', 510, 14, 'Beta-carotene, fiber'),
      meal('snack',       'Roasted peanuts',              'Roasted peanuts (30g)',                                         160, 7,  'Niacin, healthy fats'),
      meal('dinner',      'Soya chunks + beetroot + lauki','Soya chunks curry (40g dry) + roasted beetroot + bottle gourd', 400, 24, 'High protein, folate, nitrates'),
      meal('bed',         'Buttermilk',                   'Buttermilk (1 glass)',                                          60,  3,  'Probiotics'),
    ],
  },
  {
    dayIndex: 4, label: 'Day 4', totalCalories: 1920, totalProtein: 91,
    flag: 'recomputed — original total was off by 80; add fruit + 1 tbsp seeds',
    meals: [
      meal('early_am',    'Pecans + chia',                'Pecans (5-6 halves) + chia (1 tbsp, soaked)',                   160, 4,  'Antioxidants, manganese, omega-3'),
      meal('breakfast',   'Whey + oats upma + papaya',    'Whey + milk + oats upma (1 bowl) + papaya (1 cup)',             460, 31, 'Beta-carotene, fiber, B12'),
      meal('mid_morning', 'Cottage cheese',               'Cottage cheese (½ cup)',                                        110, 14, 'Casein protein, calcium'),
      meal('lunch',       'Rajma + rice + cabbage',       'Rajma (1 cup) + brown rice (¾ cup) + cabbage sabzi + carrot-onion salad', 540, 16, 'Iron, fiber, vit C'),
      meal('snack',       'Roasted makhana',              'Roasted makhana (30g)',                                         110, 4,  'Low-cal, magnesium'),
      meal('dinner',      'Tofu tikka + parsnip + beans', 'Tofu tikka (100g) + roasted parsnip + green beans',             420, 16, 'Protein, fiber, potassium'),
      meal('bed',         'Warm milk',                    'Warm milk (1 cup)',                                             120, 6,  'Calcium'),
    ],
  },
  {
    dayIndex: 5, label: 'Day 5', totalCalories: 1970, totalProtein: 99,
    meals: [
      meal('early_am',    'Hazelnuts + walnuts',          'Hazelnuts (8-10) + walnuts (2)',                                150, 4,  'Vit E, folate, omega-3'),
      meal('breakfast',   'Whey + moong cheela + guava',  'Whey + milk + moong dal cheela (2) + guava (1)',                470, 33, 'Vit C, protein'),
      meal('mid_morning', 'Greek yogurt + pumpkin seeds', 'Greek yogurt (1 cup) + pumpkin seeds (1 tbsp)',                 190, 17, 'Zinc, probiotics'),
      meal('lunch',       'Chana dal + bajra roti + roots','Chana dal (1 cup) + bajra roti (2) + mixed root veg (carrot, turnip, sweet potato) + radish salad', 540, 15, 'Iron, fiber, complex carbs'),
      meal('snack',       'Boiled chana',                 'Boiled chana (½ cup, with onion + lemon)',                      130, 7,  'Protein, vit C'),
      meal('dinner',      'Paneer + spinach + dal',       'Paneer (80g) + sauteed spinach + dal (½ cup)',                  430, 20, 'Calcium, iron, protein'),
      meal('bed',         'Buttermilk',                   'Buttermilk (1 glass)',                                          60,  3,  'Probiotics'),
    ],
  },
  {
    dayIndex: 6, label: 'Day 6', totalCalories: 2000, totalProtein: 99,
    meals: [
      meal('early_am',    'Pistachios + flax',            'Pistachios (10) + flax (1 tbsp)',                               140, 4,  'Omega-3, potassium'),
      meal('breakfast',   'Whey + idli + sambar + banana','Whey + milk + idli (3) + sambar + banana',                      490, 33, 'Probiotics (fermented), B12'),
      meal('mid_morning', 'Hung curd + chia',             'Hung curd (¾ cup) + chia',                                      170, 14, 'Omega-3, probiotics'),
      meal('lunch',       'Urad dal + rice + beet-carrot','Urad dal (1 cup) + brown rice (¾ cup) + beetroot-carrot sabzi + kachumber salad', 510, 14, 'Iron, nitrates, fiber'),
      meal('snack',       'Sprouted matki',               'Sprouted matki (¾ cup)',                                        130, 8,  'Enzymes, protein'),
      meal('dinner',      'Tempeh + sweet potato + broccoli','Tempeh stir-fry (100g) + roasted sweet potato + broccoli',   440, 20, 'Complete protein, probiotics, vit C'),
      meal('bed',         'Warm milk + turmeric',         'Warm milk + turmeric',                                          120, 6,  'Calcium'),
    ],
  },
  {
    dayIndex: 7, label: 'Day 7', totalCalories: 2000, totalProtein: 98,
    meals: [
      meal('early_am',    'Almonds + tiger nuts',         'Almonds (8) + tiger nuts (20g, soaked)',                        160, 4,  'Vit E, prebiotic fiber, resistant starch'),
      meal('breakfast',   'Whey + veg dalia + apple',     'Whey + milk + vegetable dalia (1 bowl) + apple',                460, 31, 'Fiber, B12'),
      meal('mid_morning', 'Greek yogurt + walnuts',       'Greek yogurt (1 cup) + walnuts (3)',                            200, 17, 'Omega-3, probiotics'),
      meal('lunch',       'Panchmel dal + quinoa + cauli','Panchmel dal (1 cup) + quinoa (¾ cup) + cauliflower-carrot sabzi + sprout salad', 540, 18, 'Complete protein, fiber, vit C'),
      meal('snack',       'Chana + peanuts mix',          'Mixed roasted chana + peanuts (30g)',                           150, 7,  'Protein, niacin'),
      meal('dinner',      'Paneer + rutabaga + kale',     'Paneer (80g) + mashed rutabaga + sauteed kale',                 430, 18, 'Calcium, vit K, protein'),
      meal('bed',         'Buttermilk',                   'Buttermilk',                                                    60,  3,  'Probiotics'),
    ],
  },
  // ---------- WEEK 2 ----------
  {
    dayIndex: 8, label: 'Day 8', totalCalories: 1970, totalProtein: 103,
    meals: [
      meal('early_am',    'Macadamia + pumpkin seeds',    'Macadamia (4-5) + pumpkin seeds (1 tbsp)',                      170, 5,  'Monounsaturated fat, zinc, magnesium'),
      meal('breakfast',   'Whey + besan dhokla + orange', 'Whey + milk + besan dhokla (4 pcs) + orange',                   470, 33, 'Vit C, probiotics'),
      meal('mid_morning', 'Cottage cheese + flax',        'Cottage cheese (½ cup) + flax',                                 140, 15, 'Casein, omega-3'),
      meal('lunch',       'Lobia + rice + ridge gourd',   'Lobia/black-eyed peas (1 cup) + brown rice (¾ cup) + ridge gourd + beet salad', 530, 16, 'Folate, iron, fiber'),
      meal('snack',       'Roasted soya nuts',            'Roasted soya nuts (30g)',                                       130, 12, 'High protein'),
      meal('dinner',      'Tofu + carrots + Swiss chard', 'Tofu (100g) + roasted carrots + sauteed Swiss chard',           410, 16, 'Protein, vit A, vit K'),
      meal('bed',         'Warm milk',                    'Warm milk',                                                     120, 6,  'Calcium'),
    ],
  },
  {
    dayIndex: 9, label: 'Day 9', totalCalories: 1890, totalProtein: 95,
    flag: 'lowest day in plan — add 1 fruit + extra ½ tbsp seeds',
    meals: [
      meal('early_am',    'Almonds + chia',               'Almonds (8) + chia (soaked)',                                   120, 4,  'Omega-3, vit E'),
      meal('breakfast',   'Whey + moong dosa + papaya',   'Whey + milk + moong dosa (2) + papaya',                         470, 33, 'Beta-carotene, protein'),
      meal('mid_morning', 'Greek yogurt + sunflower',     'Greek yogurt (1 cup) + sunflower seeds',                        190, 17, 'Vit E, probiotics'),
      meal('lunch',       'Moong dal + jowar + baingan',  'Moong dal (1 cup) + jowar roti (2) + baingan sabzi + beet-radish salad', 500, 14, 'Iron, fiber, antioxidants'),
      meal('snack',       'Roasted makhana',              'Roasted makhana (30g)',                                         110, 4,  'Magnesium'),
      meal('dinner',      'Paneer + sweet potato + methi','Paneer (80g) + roasted sweet potato + methi',                   440, 20, 'Calcium, vit A, iron'),
      meal('bed',         'Buttermilk',                   'Buttermilk',                                                    60,  3,  'Probiotics'),
    ],
  },
  {
    dayIndex: 10, label: 'Day 10', totalCalories: 1970, totalProtein: 102,
    flag: 'recomputed — original total was off by 70',
    meals: [
      meal('early_am',    'Cashews + Brazil nut',         'Cashews (6) + Brazil nut (1)',                                  130, 4,  'Selenium, magnesium'),
      meal('breakfast',   'Whey + poha + banana',         'Whey + milk + poha + banana',                                   470, 30, 'Potassium, B12'),
      meal('mid_morning', 'Hung curd + chia',             'Hung curd (¾ cup) + chia',                                      170, 14, 'Omega-3, probiotics'),
      meal('lunch',       'Kala chana + rice + cabbage',  'Kala chana (1 cup) + brown rice (¾ cup) + cabbage + carrot salad', 540, 16, 'Iron, fiber'),
      meal('snack',       'Sprouted moong',               'Sprouted moong (¾ cup)',                                        130, 8,  'Enzymes, vit C'),
      meal('dinner',      'Soya chunks + beetroot + spinach','Soya chunks (40g dry) + roasted beetroot + spinach',         410, 24, 'High protein, nitrates, iron'),
      meal('bed',         'Warm milk',                    'Warm milk',                                                     120, 6,  'Calcium'),
    ],
  },
  {
    dayIndex: 11, label: 'Day 11', totalCalories: 1980, totalProtein: 97,
    meals: [
      meal('early_am',    'Pine nuts + chironji',         'Pine nuts/chilgoza (1 tbsp) + chironji (1 tsp)',                150, 4,  'Vit K, zinc, iron, calcium'),
      meal('breakfast',   'Whey + ragi idli + guava',     'Whey + milk + ragi idli (3) + guava',                           460, 31, 'Calcium, vit C'),
      meal('mid_morning', 'Greek yogurt + pumpkin seeds', 'Greek yogurt (1 cup) + pumpkin seeds',                          190, 17, 'Zinc, probiotics'),
      meal('lunch',       'Masoor + bajra + root mash',   'Masoor dal (1 cup) + bajra roti (2) + mixed root mash (turnip, carrot, parsnip) + radish salad', 530, 15, 'Iron, fiber, complex carbs'),
      meal('snack',       'Roasted peanuts',              'Roasted peanuts (30g)',                                         160, 7,  'Niacin'),
      meal('dinner',      'Tempeh + carrots + broccoli',  'Tempeh (100g) + roasted carrots + broccoli',                    430, 20, 'Complete protein, probiotics'),
      meal('bed',         'Buttermilk',                   'Buttermilk',                                                    60,  3,  'Probiotics'),
    ],
  },
  {
    dayIndex: 12, label: 'Day 12', totalCalories: 2050, totalProtein: 99,
    flag: 'recomputed — original total was off by 30',
    meals: [
      meal('early_am',    'Almonds + tiger nuts',         'Almonds (8) + tiger nuts (20g, soaked)',                        160, 4,  'Vit E, prebiotic fiber'),
      meal('breakfast',   'Whey + besan chilla + orange', 'Whey + milk + besan chilla (2) + orange',                       470, 33, 'Vit C, protein'),
      meal('mid_morning', 'Cottage cheese + walnuts',     'Cottage cheese (½ cup) + walnuts (3)',                          200, 17, 'Casein, omega-3'),
      meal('lunch',       'Toor + rice + sweet potato',   'Toor dal (1 cup) + brown rice (¾ cup) + sweet potato-pea sabzi + kachumber', 540, 14, 'Vit A, fiber'),
      meal('snack',       'Boiled chana',                 'Boiled chana (½ cup)',                                          130, 7,  'Protein'),
      meal('dinner',      'Paneer tikka + parsnip + beans','Paneer tikka (80g) + roasted parsnip + green beans',           430, 18, 'Calcium, fiber'),
      meal('bed',         'Warm milk + turmeric',         'Warm milk + turmeric',                                          120, 6,  'Calcium'),
    ],
  },
  {
    dayIndex: 13, label: 'Day 13', totalCalories: 1940, totalProtein: 99,
    flag: 'recomputed — add 1 fruit at mid-morning',
    meals: [
      meal('early_am',    'Walnuts + chia',               'Walnuts (4) + chia (soaked)',                                   140, 4,  'Omega-3'),
      meal('breakfast',   'Whey + oats upma + apple',     'Whey + milk + oats upma + apple',                               460, 30, 'Fiber, B12'),
      meal('mid_morning', 'Greek yogurt + flax',          'Greek yogurt (1 cup) + flax',                                   170, 16, 'Omega-3, probiotics'),
      meal('lunch',       'Rajma + quinoa + beet-carrot', 'Rajma (1 cup) + quinoa (¾ cup) + beetroot-carrot sabzi + sprout salad', 550, 18, 'Complete protein, iron, nitrates'),
      meal('snack',       'Roasted soya nuts',            'Roasted soya nuts (30g)',                                       130, 12, 'High protein'),
      meal('dinner',      'Tofu + sweet potato + kale',   'Tofu stir-fry (100g) + roasted sweet potato + kale',            430, 16, 'Protein, vit A, vit K'),
      meal('bed',         'Buttermilk',                   'Buttermilk',                                                    60,  3,  'Probiotics'),
    ],
  },
  {
    dayIndex: 14, label: 'Day 14', totalCalories: 2030, totalProtein: 98,
    flag: 'recomputed — original total was off by 40',
    meals: [
      meal('early_am',    'Pecans + pistachios',          'Pecans (5-6 halves) + pistachios (6)',                          170, 5,  'Antioxidants, potassium, manganese'),
      meal('breakfast',   'Whey + veg dalia + banana',    'Whey + milk + vegetable dalia + banana',                        470, 31, 'Fiber, B12, potassium'),
      meal('mid_morning', 'Hung curd + sunflower seeds',  'Hung curd (¾ cup) + sunflower seeds',                           170, 14, 'Vit E, probiotics'),
      meal('lunch',       'Panchmel + rice + carrot-turnip','Panchmel dal (1 cup) + brown rice (¾ cup) + carrot-turnip-pea sabzi + onion-tomato salad', 540, 16, 'Complete protein, beta-carotene'),
      meal('snack',       'Sprouted matki chaat',         'Sprouted matki chaat (¾ cup)',                                  130, 8,  'Enzymes, protein'),
      meal('dinner',      'Paneer + rutabaga + greens',   'Paneer (80g) + roasted rutabaga + mixed greens',                430, 18, 'Calcium, vit K'),
      meal('bed',         'Warm milk',                    'Warm milk',                                                     120, 6,  'Calcium'),
    ],
  },
];

const PLAN = {
  name:        PLAN_NAME,
  description: '14-day rotation, ~2,000 kcal / ~98g protein daily. Maximum diversity across nuts, seeds, dals, soy, dairy, whole grains, roots, greens. No food repeats more than twice in 14 days. Whey + B12/D3/algal-omega-3 supplements assumed.',
  cycleLength: 14,
  days:        DAYS.map((d, i) => ({
    ...d,
    meals: d.meals.map((m, j) => ({ ...m, order: j })),
  })),
};

function parseArgs(argv) {
  const args = { dryRun: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') args.dryRun = true;
    else console.warn(`Ignoring unknown arg: ${raw}`);
  }
  return args;
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not set. Did you populate server/.env?');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    console.log(`Seeding master MealPlan "${PLAN_NAME}" ${dryRun ? '[DRY RUN]' : ''}`);
    console.log(`  Days:          ${PLAN.days.length}`);
    console.log(`  Meals total:   ${PLAN.days.reduce((s, d) => s + d.meals.length, 0)}`);
    const avgCal     = Math.round(PLAN.days.reduce((s, d) => s + (d.totalCalories || 0), 0) / PLAN.days.length);
    const avgProtein = (PLAN.days.reduce((s, d) => s + (d.totalProtein || 0), 0) / PLAN.days.length).toFixed(1);
    console.log(`  Avg per day:   ${avgCal} kcal · ${avgProtein}g protein`);

    const existing = await MealPlan.findOne({ isMaster: true, name: PLAN_NAME });
    if (existing) {
      if (dryRun) {
        console.log(`  would-update  master plan ${existing._id}`);
      } else {
        existing.description = PLAN.description;
        existing.cycleLength = PLAN.cycleLength;
        existing.days        = PLAN.days;
        existing.archivedAt  = null;
        await existing.save();
        console.log(`  updated       master plan ${existing._id}`);
      }
    } else {
      if (dryRun) {
        console.log('  would-create  master plan');
      } else {
        const plan = await MealPlan.create({
          isMaster:    true,
          ownerUserId: null,
          name:        PLAN.name,
          description: PLAN.description,
          cycleLength: PLAN.cycleLength,
          days:        PLAN.days,
        });
        console.log(`  created       master plan ${plan._id}`);
      }
    }

    console.log('\nDone.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
