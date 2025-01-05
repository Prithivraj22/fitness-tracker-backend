const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const moment = require('moment');  
require('dotenv').config();
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT ||4000;
require('./config.js')
const routes = require('./routes');
app.use(cookieParser())
app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true, 
  }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.get('/', (req, res) => {
  res.send("Welcome to our Fitness Tracker!");
});


app.use(routes);


const refreshAccessToken = require('./middlewares/refreshFitbitToken');
app.use(refreshAccessToken);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
