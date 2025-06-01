const express = require('express');
const cron = require('node-cron');
const {User,Calorie_history} = require('./models.js');
const cors = require('cors');
// const cron = require('node-cron');
const controll= require('./controller.js');
const moment = require('moment');  
require('dotenv').config();
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT ||4000;
require('./config.js')
const routes = require('./routes');
const authorize = require('./Authorize.js');
// let userId=9089;
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
// cron.schedule('*/1 * * * *', async () => {
//   console.log("Cron scheduler scheduled and working successfully");

//   try {
//     // Call authorize and update calorie
//     //  authorize// Ensure authorize() is asynchronous if needed
//     controll.updateCalorieAtMidnight() // Ensure updateCalorieAtMidnight() handles database updates correctly

//     console.log("Calorie update task completed successfully at midnight.");
//   } catch (error) {
//     console.error("An error occurred during the cron job execution:", error);
//   }
// });
cron.schedule('55 23 * * *', async () => {
  const users = await User.find({});
  var datetime = new Date();
  const date=datetime.toISOString().slice(0,10)
  for (let i = 0; i < users.length; i++) {
    const userId = users[i]._id;
    const user=users[i];
    const ch=new Calorie_history({date:date,calorie_in:users[i].calorie,calorie_burnt:1000,author:userId});
    ch.save();
    

    // Update field
    user.Calorie=0;

    user.Protein=0;
    user.Fat=0;
    user.Carbs=0;
    await user.save();
    

    // Delay 2 seconds between each update
    await new Promise(res => setTimeout(res, 0));
  }
});


const refreshAccessToken = require('./middlewares/refreshFitbitToken');
app.use(refreshAccessToken);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
