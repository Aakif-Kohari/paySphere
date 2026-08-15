const express = require('express');
const jwt = require('jsonwebtoken');
const payrollController = require('./controllers/payroll.controller');

const app = express();

app.use(express.json());

// Simple Auth Middleware checking Bearer Token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization required' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Routes
app.post('/api/payroll/calculate', authMiddleware, payrollController.calculatePayroll);
app.get('/api/payroll/history', authMiddleware, payrollController.getPayrollHistory);

module.exports = app;
