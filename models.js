const mongoose=require('mongoose');
const Schema=mongoose.Schema;
const user=new Schema
(
    {
        username:{type:'String',required:true},
        // userId:{type:'uuid',required:true,unique:true},
        password:{type:'String',required:true},
        email:{type:'String',required:true},
        mobileno:{type:'Number',default:9361648407},
        height:{type:'Number'},
        weight:{type:'Number'},
        dob:{type:'Date'},
        country:{type:'String'},

        gender:{type:'Boolean'},
        macros:[],
        bloodGroup:{type:"String"},
        RHtype:{type:'Boolean'}

    }
)
const food=new Schema(
    {
        dish_name:{type:'String',unique:true},
        calorie:{type:'Number'},
        // c_b:{type:'Number'},
        protein:{type:'Number'},
        fat:{type:'Number'},
        carbs:{type:'Number'}

    }
)
const calorie_history=new Schema(
    {
        
        date:{type:'Date'},
        
        calorie_in:{type:'Number'},
        calorie_burnt:{type:'Number'},
        author: { 
            type: mongoose.Schema.Types.ObjectId, // Foreign key
            ref: 'User', // Reference to the User model
            required: true
        }
    }

)
const User=mongoose.model('User',user);
module.exports ={User};