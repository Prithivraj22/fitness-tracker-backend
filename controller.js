const {User,Food}=require('./models')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const secretKey=process.env.SECRET_KEY
exports.signup=async(req,res)=>{         
    try {    
        const hashed_pass=await bcrypt.hash(req.body.password,10);
        const user=await  User({
            username:req.body.username,
       
        password:hashed_pass,
        email:req.body.email,
        // mobileno:req.body.mobileno,
        height:req.body.height,
        weight:req.body.weight,
        dob:req.body.dob,
        country:req.body.country,

        gender:req.body.gender,
        bloodGroup:req.body.bloodGroup,
        RHtype:req.body.RHtype

        });
        await user.save();
        console.log(process.env.SECRET_KEY);
        const token = jwt.sign({ userId: user._id, email: user.email }, process.env.SECRET_KEY, {
            expiresIn: '1h',
          });
          res.cookie('token', token, {
            httpOnly: true,              secure: true,    
            sameSite: 'strict',
            maxAge: 3600000, 
          });  
        res.send(token);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
   
   
    
   
}
exports.CreateMeal=async(req,res)=>{
    try{
        const new_meal=await Food(req.body);
        await new_meal.save();
        res.send(new_meal);
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");

    }
}
exports.updateMacros=async(req,res)=>{
    const user_id=req.body.user_id;
    // console.log(req.body)
    // const u=await User.findOne({_id:user_id});
    // console.log(u);
    try{

        await User.findOneAndUpdate({_id:user_id},{$inc:{Calorie:req.body.calorie,Protein:req.body.protein,Fat:req.body.fat,Carbs:req.body.carbs},function(err, doc){
            if(err){
                console.log("Something wrong when updating data!");
            }
        
            console.log(doc);
        }})
        const u=await User.findOne({_id:user_id});
        res.send(u);
        console.log("user sucessfully updated")
    }
    catch(err){console.log(err)}

}


// Fetch Strava Activities
exports.getStravaActivities = async (req, res) => {
    const accessToken = req.query.accessToken;

    if (!accessToken) {
        return res.status(400).send('Access token is missing.');
    }

    try {
        const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const strideLen = 0.82; // Default stride length
        const activities = response.data.map(activity => {
            // Calculate step count based on activity type
            let stepCount = 'N/A';
            if (activity.type === "Run" || activity.type === "Walk") {
                stepCount = Math.round(activity.distance / strideLen);
            }

            // Return the formatted activity object
            return {
                id: activity.id,
                name: activity.name,
                distance: activity.distance,
                duration: activity.elapsed_time,
                type: activity.type,
                start_date_local: activity.start_date_local,
                average_speed: activity.average_speed,
                calories: activity.calories || 'N/A',
                stepCount,
            };
        });

        res.json({
            message: 'Activities fetched successfully!',
            activities,
        });
    } catch (err) {
        console.error('Error fetching activities:', err.message);
        res.status(500).send('Failed to fetch activities.');
    }
};

// Fetch Strava Activity Details that can used later for extending the activiy details currently not needed
/*   exports.getStravaActivityDetails = async (req, res) => {
    const accessToken = req.query.accessToken;
    const activityId = req.params.activityId;

    if (!accessToken || !activityId) {
        return res.status(400).send('Access token or activity ID is missing.');
    }

    try {
        const response = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const activity = response.data;

        const detailedData = {
            id: activity.id,
            name: activity.name,
            description: activity.description || 'N/A',
            distance: activity.distance,
            duration: activity.elapsed_time,
            heartRate: activity.average_heartrate || 'N/A',
            maxHeartRate: activity.max_heartrate || 'N/A',
            calories: activity.calories || 'N/A',
            map: activity.map || 'N/A',
        };

        res.json({
            message: 'Activity details fetched successfully!',
            activity: detailedData,
        });
    } catch (err) {
        console.error('Error fetching activity details:', err.message);
        res.status(500).send('Failed to fetch activity details.');
    }
};*/

