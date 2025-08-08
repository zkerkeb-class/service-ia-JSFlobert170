const pool = require('../db');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.generateMealPlan = async (req, res) => {
  const userId = req.user.id;
  try {
    const profileResult = await pool.query('SELECT * FROM "Profile" WHERE user_id = $1', [userId]);
    const profile = profileResult.rows[0];

    if (!profile) return res.status(404).json({ error: "Profil utilisateur non trouvé." });

    const prompt = `
      L'utilisateur a les caractéristiques suivantes :
      - Âge : ${profile.age}
      - Poids : ${profile.weight} kg
      - Taille : ${profile.height} cm
      - Objectif fitness : ${profile.fitness_goal} (${profile.goal_detail})
      Génère un plan nutritionnel détaillé sur 7 jours adapté à ce profil et à son objectif.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Tu es un nutritionniste diplômé." },
        { role: "user", content: prompt }
      ]
    });

    res.json({ mealPlan: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur interne" });
  }
};
