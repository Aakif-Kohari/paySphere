require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paysphere-payroll';

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to Payroll Database');
    app.listen(PORT, () => {
      console.log(`Payroll Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Payroll Service boot failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
