const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');

// Middleware d'auth à placer ici
router.post('/generate', nutritionController.generateMealPlan);

module.exports = router;
