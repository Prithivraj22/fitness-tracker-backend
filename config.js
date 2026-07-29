// Export mongoose



const mongoose = require('mongoose');

//Assign MongoDB connection string to Uri and declare options settings
const uri = process.env.MONGO_URI;
console.log("Mongo URI:", uri);

if (!uri) {
  console.error('MONGO_URI is not set. Add it to fitness-tracker-backend/.env');
  process.exit(1);
}
// Declare a variable named option and assign optional settings
mongoose.connect(uri)
  .then(() => {
    console.log("Database connection established!");
  })
  .catch(err => {
    console.error("Error connecting Database instance due to:", err);
  });