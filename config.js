// Export mongoose



const mongoose = require('mongoose');

//Assign MongoDB connection string to Uri and declare options settings
const uri = process.env.MONGO_URI;

if (!uri) {
  console.error('MONGO_URI is not set. Add it to fitness-tracker-backend/.env');
  process.exit(1);
}
// Declare a variable named option and assign optional settings
mongoose.connect(uri)
  .then(() => {})
  .catch(err => {
    console.error("Database connection failed.");
  });