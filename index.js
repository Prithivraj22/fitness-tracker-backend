const express = require('express');
const cors = require('cors');
const cron = require('node-cron'); 
require('dotenv').config();
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT ||4000;
require('./config.js')
const routes = require('./routes');
app.use(cookieParser())
app.use(cors({
    origin: 'http://localhost:3000', // Frontend URL
    credentials: true,              // Allow cookies
}))
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    
    res.send("Welcome to our fitness Tracker!");
});
cron.schedule('55 14 * * *', () => {
    console.log("Event triggered at 2:28 PM!");
    // Add your event logic here
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
// const routes = require('./route')

app.use(routes);

const refreshAccessToken = require('./middlewares/refreshFitbitToken');
app.use(refreshAccessToken);