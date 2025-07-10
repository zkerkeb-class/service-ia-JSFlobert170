const express = require('express');
const router = express.Router();
const workoutController = require('../controllers/workoutController');
const checkJWT = require('../middlewares/checkJWT');

// Middleware d'auth à placer ici (req.user.id doit être dispo)
router.post('/generate', checkJWT, workoutController.generateWorkoutPlan);

module.exports = router;
