require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  req.user = { id: 1 }; // TEMP : userId fixé à 1 pour test
  next();
});

const workoutRoutes = require('./routes/workoutRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');

app.use('/api/workout', workoutRoutes);
app.use('/api/nutrition', nutritionRoutes);

app.listen(process.env.PORT || 3002, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3002}`)
});
