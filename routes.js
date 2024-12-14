const express=require('express');
const router=express.Router();
const controll = require('./controller')

    // console.log("hai")
router.post('/signup',controll.signup);

module.exports=router;

