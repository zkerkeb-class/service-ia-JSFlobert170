const prisma = require('../prisma'); // Ton fichier qui expose PrismaClient
const { OpenAI } = require('openai');

// Configuration OpenAI (optionnel)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Base d'exercices complète pour génération dynamique
const EXERCISE_DATABASE = {
  'perte de poids': [
    { name: 'Sprints', description: 'Sprint haute intensité', category: 'cardio', intensity: 'high', unit: 'meters', defaultValue: 100 },
    { name: 'Burpees', description: 'Exercice complet cardio-musculaire', category: 'cardio', intensity: 'high', bodyweight: true },
    { name: 'Mountain Climbers', description: 'Exercice cardio et core intensif', category: 'cardio', intensity: 'high', bodyweight: true },
    { name: 'Jumping Jacks', description: 'Cardio complet dynamique', category: 'cardio', intensity: 'medium', bodyweight: true },
    { name: 'High Knees', description: 'Cardio intensif genoux hauts', category: 'cardio', intensity: 'high', bodyweight: true },
    { name: 'Squat Jumps', description: 'Plyométrie pour jambes', category: 'legs', intensity: 'high', bodyweight: true },
    { name: 'Push-up to T', description: 'Pompes avec rotation', category: 'upper', intensity: 'medium', bodyweight: true },
    { name: 'Plank Jacks', description: 'Gainage dynamique', category: 'core', intensity: 'medium', bodyweight: true },
    { name: 'Bicycle Crunches', description: 'Abdos dynamiques', category: 'core', intensity: 'medium', bodyweight: true }
  ],
  'prise de masse': [
    { name: 'Développé couché', description: 'Développement pectoraux', category: 'upper', intensity: 'high' },
    { name: 'Squats avec barre', description: 'Développement jambes', category: 'legs', intensity: 'high' },
    { name: 'Deadlift', description: 'Exercice complet de force', category: 'full', intensity: 'high' },
    { name: 'Tractions', description: 'Développement dos', category: 'upper', intensity: 'high', bodyweight: true },
    { name: 'Dips', description: 'Développement triceps', category: 'upper', intensity: 'medium', bodyweight: true },
    { name: 'Overhead Press', description: 'Développement épaules', category: 'upper', intensity: 'high' },
    { name: 'Romanian Deadlift', description: 'Ischio-jambiers et fessiers', category: 'legs', intensity: 'high' },
    { name: 'Pull-ups', description: 'Dorsaux et biceps', category: 'upper', intensity: 'high', bodyweight: true }
  ],
  'endurance': [
    { name: 'Running en place', description: 'Cardio longue durée', category: 'cardio', intensity: 'medium', bodyweight: true },
    { name: 'Cycling', description: 'Endurance cardiovasculaire', category: 'cardio', intensity: 'medium', bodyweight: true },
    { name: 'Elliptique', description: 'Cardio complet faible impact', category: 'cardio', intensity: 'medium', bodyweight: true },
    { name: 'Squats', description: 'Résistance musculaire jambes', category: 'legs', intensity: 'low', bodyweight: true },
    { name: 'Push-ups', description: 'Résistance haut du corps', category: 'upper', intensity: 'low', bodyweight: true },
    { name: 'Plank hold', description: 'Endurance core', category: 'core', intensity: 'medium', bodyweight: true },
    { name: 'Lunges', description: 'Endurance dynamique jambes', category: 'legs', intensity: 'medium', bodyweight: true }
  ],
  'tonification': [
    { name: 'Pompes', description: 'Tonification pectoraux', category: 'upper', intensity: 'medium', bodyweight: true },
    { name: 'Squats', description: 'Tonification jambes', category: 'legs', intensity: 'medium', bodyweight: true },
    { name: 'Lunges', description: 'Tonification jambes et fessiers', category: 'legs', intensity: 'medium', bodyweight: true },
    { name: 'Plank', description: 'Renforcement core', category: 'core', intensity: 'medium', bodyweight: true },
    { name: 'Side plank', description: 'Tonification obliques', category: 'core', intensity: 'medium', bodyweight: true },
    { name: 'Tricep dips', description: 'Tonification triceps', category: 'upper', intensity: 'medium', bodyweight: true },
    { name: 'Glute bridges', description: 'Tonification fessiers', category: 'legs', intensity: 'low', bodyweight: true }
  ]
};

// Constantes pour les calculs
const EXERCISE_INTENSITY = {
  cardio: {
    low: { met: 4, timePerRep: 30, sprintDistance: 50 },    // mètres pour sprint
    medium: { met: 6, timePerRep: 25, sprintDistance: 100 },
    high: { met: 8, timePerRep: 20, sprintDistance: 200 }
  },
  strength: {
    low: { met: 3, timePerRep: 4 },     // secondes par répétition
    medium: { met: 5, timePerRep: 3 },
    high: { met: 7, timePerRep: 2.5 }
  },
  compound: {
    low: { met: 4, timePerRep: 5 },     // secondes par répétition
    medium: { met: 6, timePerRep: 4 },
    high: { met: 8, timePerRep: 3 }
  }
};

const REST_PERIODS = {
  'prise de masse': { between_sets: 90, between_exercises: 120 },  // secondes
  'perte de poids': { between_sets: 30, between_exercises: 60 },
  'endurance': { between_sets: 45, between_exercises: 90 },
  'tonification': { between_sets: 60, between_exercises: 90 }
};

// Fonction utilitaire pour calculer le temps d'exercice
function calculateExerciseTime(exercise, intensity) {
  const exerciseType = exercise.category === 'cardio' ? 'cardio' : 
                      (exercise.category === 'compound' ? 'compound' : 'strength');
  const intensityLevel = intensity === 'élevé' ? 'high' : 
                        (intensity === 'faible' ? 'low' : 'medium');
  
  const { timePerRep } = EXERCISE_INTENSITY[exerciseType][intensityLevel];
  return (exercise.sets * exercise.reps * timePerRep) / 60; // Conversion en minutes
}

// Fonction utilitaire pour calculer le temps de repos
function calculateRestTime(goal, exercise) {
  const restPeriods = REST_PERIODS[goal];
  const totalRestBetweenSets = (exercise.sets - 1) * restPeriods.between_sets;
  return totalRestBetweenSets / 60; // Conversion en minutes
}

function calculateWorkoutDuration(exercises, goal, intensity) {
  let totalDuration = 0;
  const restPeriods = REST_PERIODS[goal];

  exercises.forEach((exercise, index) => {
    // Temps d'exercice
    totalDuration += calculateExerciseTime(exercise, intensity);
    
    // Temps de repos entre les séries
    totalDuration += calculateRestTime(goal, exercise);
    
    // Temps de repos entre les exercices (sauf pour le dernier)
    if (index < exercises.length - 1) {
      totalDuration += restPeriods.between_exercises / 60;
    }
  });

  // Ajouter 5 minutes pour l'échauffement et 5 minutes pour le retour au calme
  totalDuration += 10;

  return Math.round(totalDuration);
}

function calculateTotalCalories(exercises, intensity, weight, goal, duration) {
  let totalCalories = 0;

  exercises.forEach(exercise => {
    const exerciseType = exercise.category === 'cardio' ? 'cardio' : 
                        (exercise.category === 'compound' ? 'compound' : 'strength');
    const intensityLevel = intensity === 'élevé' ? 'high' : 
                          (intensity === 'faible' ? 'low' : 'medium');
    
    const { met } = EXERCISE_INTENSITY[exerciseType][intensityLevel];
    
    // Temps effectif de l'exercice en heures
    const exerciseTime = calculateExerciseTime(exercise, intensity) / 60;
    
    // Calories pour cet exercice
    let exerciseCalories = met * weight * exerciseTime * 60;
    
    // Facteurs d'ajustement selon le type d'exercice et l'intensité
    if (exercise.weight > 0) {
      // Bonus pour les exercices avec charge
      exerciseCalories *= (1 + (exercise.weight / 100));
    }
    
    if (exerciseType === 'compound') {
      // Bonus pour les exercices composés
      exerciseCalories *= 1.2;
    }
    
    totalCalories += exerciseCalories;
  });

  // Calories pendant les périodes de repos (MET = 2)
  const restTime = (duration - exercises.reduce((acc, ex) => 
    acc + calculateExerciseTime(ex, intensity), 0)) / 60;
  totalCalories += 2 * weight * restTime * 60;

  // Ajustements selon l'objectif
  switch (goal) {
    case 'perte de poids':
      totalCalories *= 1.1; // +10% pour favoriser la dépense
      break;
    case 'prise de masse':
      totalCalories *= 0.9; // -10% car focus sur la force
      break;
  }

  return Math.round(totalCalories);
}

function generateDayExercises(exercisePool, dayIndex, weekProgression, intensity, goal) {
  const numExercises = intensity === 'élevé' ? 6 : intensity === 'faible' ? 4 : 5;
  const dayShift = dayIndex * 2;
  const selectedExercises = [];
  
  // Sélectionner d'abord les exercices
  for (let i = 0; i < numExercises; i++) {
    const exerciseIndex = (i + dayShift) % exercisePool.length;
    const exercise = exercisePool[exerciseIndex];
    
    const workoutDetail = {
      sets: calculateSets(exercise, weekProgression, intensity),
      reps: calculateReps(exercise, goal, weekProgression, intensity),
      weight: calculateWeight(exercise, goal, intensity),
      exercise: {
        name: exercise.name,
        description: `${exercise.description} - ${generatePersonalizedTip(exercise, goal)}`,
        goal_type: goal,
        category: exercise.category
      }
    };
    
    selectedExercises.push(workoutDetail);
  }
  
  // Générer un nom de séance basé sur le focus du jour
  let workoutName;
  const categories = selectedExercises.map(ex => ex.exercise.category);
  const mainCategory = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const dominantCategory = Object.entries(mainCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
  
  switch(dominantCategory) {
    case 'cardio':
      workoutName = `Cardio ${weekProgression === 'intensity' ? 'Intensif' : weekProgression === 'recovery' ? 'Récupération' : 'Progression'}`;
      break;
    case 'upper':
      workoutName = `Haut du Corps ${weekProgression === 'intensity' ? 'Force' : weekProgression === 'recovery' ? 'Tonification' : 'Construction'}`;
      break;
    case 'legs':
      workoutName = `Bas du Corps ${weekProgression === 'intensity' ? 'Force' : weekProgression === 'recovery' ? 'Tonification' : 'Construction'}`;
      break;
    case 'core':
      workoutName = `Core & Stabilité ${weekProgression === 'intensity' ? 'Avancé' : weekProgression === 'recovery' ? 'Basique' : 'Intermédiaire'}`;
      break;
    default:
      workoutName = `Full Body ${weekProgression === 'intensity' ? 'Challenge' : weekProgression === 'recovery' ? 'Équilibré' : 'Progression'}`;
  }
  
  // Ajouter le numéro du jour
  workoutName = `${workoutName} - Jour ${dayIndex + 1}`;
  
  // Calculer la durée totale de la séance
  const duration = calculateWorkoutDuration(selectedExercises, goal, intensity);
  
  return {
    name: workoutName,
    exercises: selectedExercises,
    duration: duration
  };
}

function generateIntelligentPlan(dates, profile) {
  const goal = normalizeGoal(profile?.fitness_goal?.toLowerCase() || 'tonification');
  const intensity = profile?.intensity?.toLowerCase() || 'modéré';
  const age = profile?.age || 30;
  const weight = profile?.weight || 70;
  
  const exercises = EXERCISE_DATABASE[goal] || EXERCISE_DATABASE['tonification'];
  
  return dates.map((date, dayIndex) => {
    const weekProgression = dayIndex < 3 ? 'building' : dayIndex < 6 ? 'intensity' : 'recovery';
    const dayWorkout = generateDayExercises(exercises, dayIndex, weekProgression, intensity, goal);
    
    return {
      date: date,
      duration: dayWorkout.duration,
      calories_burned: calculateTotalCalories(
        dayWorkout.exercises, 
        intensity, 
        weight, 
        goal, 
        dayWorkout.duration
      ),
      details: dayWorkout.exercises
    };
  });
}

function normalizeGoal(goal) {
  const goalMapping = {
    'lose_weight': 'perte de poids',
    'gain_muscle': 'prise de masse',
    'build_endurance': 'endurance',
    'tone_body': 'tonification'
  };
  return goalMapping[goal] || goal;
}

function generateDayExercises(exercisePool, dayIndex, weekProgression, intensity, goal) {
  const numExercises = intensity === 'élevé' ? 6 : intensity === 'faible' ? 4 : 5;
  
  // Rotation intelligente des exercices par jour
  const dayShift = dayIndex * 2;
  const selectedExercises = [];
  
  for (let i = 0; i < numExercises; i++) {
    const exerciseIndex = (i + dayShift) % exercisePool.length;
    const exercise = exercisePool[exerciseIndex];
    
    const workoutDetail = {
      sets: calculateSets(exercise, weekProgression, intensity),
      reps: calculateReps(exercise, goal, weekProgression, intensity),
      weight: calculateWeight(exercise, goal, intensity),
      exercise: {
        name: exercise.name,
        description: `${exercise.description} - ${generatePersonalizedTip(exercise, goal)}`,
        goal_type: goal
      }
    };
    
    selectedExercises.push(workoutDetail);
  }
  
  return selectedExercises;
}

function calculateSets(exercise, weekProgression, intensity) {
  let baseSets = exercise.category === 'cardio' ? 4 : 3;
  if (weekProgression === 'intensity') baseSets += 1;
  if (intensity === 'élevé') baseSets += 1;
  if (intensity === 'faible') baseSets = Math.max(2, baseSets - 1);
  return baseSets;
}

function calculateReps(exercise, goal, weekProgression, intensity) {
  // Pour les sprints, on utilise la distance définie
  if (exercise.name === 'Sprints') {
    return exercise.defaultValue || EXERCISE_INTENSITY.cardio.medium.sprintDistance;
  }

  // Pour les autres exercices cardio
  if (exercise.category === 'cardio') {
    const intensityLevel = intensity === 'élevé' ? 'high' : 
                          (intensity === 'faible' ? 'low' : 'medium');
    return Math.round(EXERCISE_INTENSITY.cardio[intensityLevel].timePerRep);
  }

  // Pour les exercices de force
  let baseReps;
  switch (goal) {
    case 'prise de masse':
      baseReps = 8;
      break;
    case 'perte de poids':
      baseReps = 12;
      break;
    case 'endurance':
      baseReps = 15;
      break;
    default:
      baseReps = 10;
  }

  // Ajustements selon la progression
  switch (weekProgression) {
    case 'building':
      return baseReps;
    case 'intensity':
      return Math.round(baseReps * 1.2);
    case 'recovery':
      return Math.round(baseReps * 0.8);
    default:
      return baseReps;
  }
}

function calculateWeight(exercise, goal, intensity) {
  // Pas de poids pour les exercices de poids du corps
  if (exercise.bodyweight || exercise.category === 'cardio') {
    return 0;
  }

  // Base weight selon le type d'exercice et l'objectif
  let baseWeight = 0;
  
  switch (goal) {
    case 'prise de masse':
      baseWeight = 30;
      break;
    case 'perte de poids':
      baseWeight = 15;
      break;
    case 'endurance':
      baseWeight = 10;
      break;
    default:
      baseWeight = 20;
  }

  // Ajustements selon l'intensité
  if (intensity === 'élevé') {
    baseWeight *= 1.2;
  } else if (intensity === 'faible') {
    baseWeight *= 0.8;
  }

  return Math.round(baseWeight);
}

function calculateBaseDuration(goal, intensity, age) {
  // Durée de base selon l'objectif
  let base;
  switch (goal) {
    case 'prise de masse':
      base = 65; // Séances plus longues pour la musculation
      break;
    case 'endurance':
      base = 55; // Séances moyennes-longues pour l'endurance
      break;
    case 'perte de poids':
      base = 45; // Séances moyennes pour le cardio
      break;
    default: // tonification
      base = 40; // Séances plus courtes mais intenses
  }

  // Ajustements selon l'intensité
  switch (intensity) {
    case 'élevé':
      base += 10;
      break;
    case 'faible':
      base -= 10;
      break;
  }

  // Ajustements selon l'âge
  if (age > 60) base -= 15;
  else if (age > 50) base -= 10;
  else if (age > 40) base -= 5;

  return Math.max(20, Math.min(90, base)); // Minimum 20min, maximum 90min
}

function adjustDurationByDay(baseDuration, dayIndex, weekProgression) {
  if (dayIndex === 6) return Math.max(20, baseDuration - 20); // Jour de récupération
  if (weekProgression === 'intensity') return baseDuration + 10;
  return baseDuration;
}

function calculateCalories(duration, intensity, weight, goal) {
  // MET (Metabolic Equivalent of Task) selon l'intensité et l'objectif
  let met;
  switch (intensity) {
    case 'élevé':
      met = goal === 'prise de masse' ? 8 : 9;
      break;
    case 'faible':
      met = goal === 'endurance' ? 4 : 3;
      break;
    default: // modéré
      met = goal === 'perte de poids' ? 7 : 6;
  }

  // Formule de calcul des calories : MET × poids (kg) × durée (heures)
  const durationInHours = duration / 60;
  const calories = Math.round(met * weight * durationInHours * 60); // Multiplié par 60 pour ajuster à l'heure

  // Ajustements selon l'objectif
  let finalCalories = calories;
  switch (goal) {
    case 'perte de poids':
      finalCalories *= 1.1; // +10% pour favoriser la dépense
      break;
    case 'prise de masse':
      finalCalories *= 0.9; // -10% car focus sur la force
      break;
  }

  return Math.round(finalCalories);
}

function generatePersonalizedTip(exercise, goal) {
  const tips = {
    'perte de poids': 'Maintenir un rythme élevé pour maximiser la combustion des graisses',
    'prise de masse': 'Focus sur la forme et le contrôle du mouvement',
    'endurance': 'Maintenir un rythme constant et contrôlé',
    'tonification': 'Concentrez-vous sur la contraction musculaire'
  };
  return tips[goal] || 'Maintenez une bonne forme';
}

async function generateWithOpenAI(dates, profile) {
  if (!openai) {
    console.log('OpenAI non configuré, utilisation du générateur intelligent');
    return generateIntelligentPlan(dates, profile);
  }

  try {
    const prompt = `Tu es un coach sportif expert. Génère un plan d'entraînement de 7 jours PERSONNALISÉ pour:
    
    PROFIL UTILISATEUR:
    - Âge: ${profile?.age} ans
    - Poids: ${profile?.weight} kg  
    - Taille: ${profile?.height} cm
    - Objectif: ${profile?.fitness_goal}
    - Intensité: ${profile?.intensity}
    
    DATES: ${dates.join(', ')}
    
    EXIGENCES:
    1. EXACTEMENT 7 jours d'entraînement
    2. Exercices VARIÉS et PERSONNALISÉS selon le profil
    3. Progression intelligente sur la semaine
    4. minimum 5 exercices par jour avec sets/reps/poids adaptés
    5. ne génère pas moins de 5 exercices par jour.
    6. CHAQUE séance doit avoir un nom descriptif et motivant
    
    FORMAT JSON OBLIGATOIRE (sans commentaires):
    [
      {
        "date": "${dates[0]}",
        "name": "Nom descriptif de la séance - Jour 1",
        "duration": 45,
        "calories_burned": 350,
        "details": [
          {
            "sets": 3,
            "reps": 12,
            "weight": 20,
            "exercise": {
              "name": "Nom exercice",
              "description": "Description personnalisée selon profil",
              "goal_type": "${profile?.fitness_goal || 'fitness'}"
            }
          }
        ]
      }
    ]
    
    RÉPONDS UNIQUEMENT avec le JSON, rien d'autre.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Tu es un coach sportif expert. Réponds UNIQUEMENT en JSON valide." },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.8
    });

    const rawContent = completion.choices[0].message.content;
    const cleanJson = extractJson(rawContent);
    const data = JSON.parse(cleanJson);
    
    if (data.length === 7) {
      console.log('Plan généré avec OpenAI avec succès');
      return data;
    }
    
  } catch (error) {
    console.error('Erreur OpenAI:', error.message);
  }
  
  console.log('Fallback vers générateur intelligent');
  return generateIntelligentPlan(dates, profile);
}

function extractJson(text) {
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error('JSON array non trouvé');
  }
  
  return text.substring(firstBracket, lastBracket + 1);
}

function generateDates() {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0] + 'T08:00:00Z');
  }
  return dates;
}

exports.generateWorkoutPlan = async (req, res) => {
  const userId = req.userToken.id;
          console.log('[AI] Génération plan IA pour utilisateur:', userId);

  try {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: { profile: true },
    });

    let profile;
    if (!user?.profile) {
      console.log('📝 Profil non trouvé, profil par défaut');
      profile = {
        age: 30,
        weight: 70,
        height: 170,
        fitness_goal: 'tonification',
        intensity: 'modéré'
      };
    } else {
      profile = user.profile;
    }

    const dates = generateDates();

    console.log('👤 Profil utilisateur:', {
      age: profile?.age,
      weight: profile?.weight,
      fitness_goal: profile?.fitness_goal,
      intensity: profile?.intensity
    });

    // Génération avec IA (OpenAI si disponible, sinon IA simulée intelligente)
    const data = await generateWithOpenAI(dates, profile);
    
            console.log(`[SUCCESS] Plan IA généré: ${data.length} jours personnalisés`);
    res.json({ plan: data });

  } catch (err) {
            console.error('[ERROR] Erreur génération plan IA:', err);
    res.status(500).json({ error: "Erreur interne" });
  }
};

