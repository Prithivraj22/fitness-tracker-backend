const mongoose = require('mongoose');

const connectDatabase = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not configured.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
};

const disconnectDatabase = () => mongoose.disconnect();

const isDatabaseReady = () => mongoose.connection.readyState === 1;

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
};
