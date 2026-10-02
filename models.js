const mongoose=require('mongoose');
const Schema=mongoose.Schema;
const user=new Schema
(
    {
        username:{type:'String',required:true,trim:true,unique:true},
        displayName:{type:'String',trim:true,maxlength:100},
        // userId:{type:'uuid',required:true,unique:true},
        password:{type:'String',required:true,select:false},
        email:{type:'String',required:true,trim:true,lowercase:true,unique:true},
        mobileno:{type:'String',trim:true,match:/^\+?[0-9 ()-]{7,25}$/},
        height:{type:'Number',min:50,max:300},
        weight:{type:'Number',min:10,max:500},
        dob:{type:'Date',required:true},
        country:{type:'String'},

        gender:{type:'Boolean'},
        Calorie:{type:'Number',default:0,min:0},

        Protein:{type:'Number',default:0,min:0},
        Fat:{type:'Number',default:0,min:0},
        Carbs:{type:'Number',default:0,min:0},
        nutritionDate:{type:'String',match:/^\d{4}-\d{2}-\d{2}$/},
        bloodGroup:{type:"String"},
        RHtype:{type:'Boolean',default:false},
        refreshTokenHash:{type:'String',select:false},
        fitbitAccessToken:{type:'String',select:false},
        fitbitRefreshToken:{type:'String',select:false},
        fitbitAccessTokenExpiresAt:{type:'Date',select:false},
        healthProvider:{type:'String',enum:['fitbit','google']},
        googleHealthAccessToken:{type:'String',select:false},
        googleHealthRefreshToken:{type:'String',select:false},
        googleHealthAccessTokenExpiresAt:{type:'Date',select:false},
        googleHealthUserId:{type:'String',select:false},
        googleHealthLegacyUserId:{type:'String',select:false},
        googleHealthScopes:[{type:'String',select:false}]

    }
)
const food=new Schema(
    
    {
        dish_name:{type:'String',required:true,trim:true,unique:true},
        calorie:{type:'Number',required:true,min:0},
        protein:{type:'Number',required:true,min:0},
        fat:{type:'Number',required:true,min:0},
        carbs:{type:'Number',required:true,min:0},
        servingDescription:{type:'String',required:true,trim:true,maxlength:80}

    }
)
const calorie_history = new Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        date: { type: 'Date', required: true },
        calorie_in: { type: 'Number', default: 0, min: 0 },
        calorie_burnt: { type: 'Number', default: 0, min: 0 },
    },
    { timestamps: true }
)

calorie_history.index({ author: 1, date: 1 }, { unique: true });
const User=mongoose.model('User',user);
const Food=mongoose.model('Food',food);
// Keep the original collection name so existing calorie history remains available.
const CalorieHistory=mongoose.model('CalorieHistory',calorie_history,'calorie_histories');
module.exports ={User,Food,CalorieHistory};
