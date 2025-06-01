const jwt = require('jsonwebtoken');
const refresh=require('./refreshController');
const secretKey = process.env.SECRET_KEY

module.exports = (req,res,next)=>{
    try{
        console.log("Checking-------");

        let token=req.cookies.acessToken;
        console.log("Checking-------");
        if(!token){
            console.log("Checking-------");

            const mes=refresh.RefreshController(req, res);
            console.log(mes)
            if (mes=='404')return res.send(404);
            else{
                token=mes;
        const decodedToken = jwt.verify(token,secretKey);
        userId=decodedToken.userId;
        req.userData={userId:decodedToken.userId,email:decodedToken.email};
        console.log(decodedToken);
        next();
                
                
                };
            
        }
        else if(token){
        // token=req.cookies.acessToken;
        const decodedToken = jwt.verify(token,secretKey);
        // userId=decodedToken.userId;
        req.userData={userId:decodedToken.userId,email:decodedToken.email};
        console.log(decodedToken);
        next();}
    }
    catch(err){
        return res.status(401).json({ error: 'Authentication failed' });
    }

}
// exports.Authorize=(req, res) => {

// }
