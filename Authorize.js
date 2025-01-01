const jwt = require('jsonwebtoken');
const secretKey = process.env.SECRET_KEY
module.exports = (req,res,next)=>{
    try{
        const token=req.cookies.token;
        if(!token){
            return res.status(401).json({ error: 'Authentication failed: Token missing' });
        }
        const decodedToken = jwt.verify(token,secretKey);
        req.userData={userId:decodedToken.userId,email:decodedToken.email};
        console.log(decodedToken);
        next();
    }
    catch(err){
        return res.status(401).json({ error: 'Authentication failed' });
    }

}
