const {User,Food}=require('./models')
exports.signup=async(req,res)=>{
    try {
        console.log('hai?');
        const user=await User(req.body);
        await user.save();
        console.log(user);
        res.send('hai?');
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