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