const express = require('express');
const authController = require('./controllers/auth.controller');

const app = express();

app.use(express.json());

// Routes
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/validate', authController.validateToken);

module.exports = app;
