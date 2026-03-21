import mongoose from "mongoose";
import Vehicle from "./Vehicle";

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    fullName :{
            type: String,
            required:true,
            trim:true,
            index:true
        },
    password:{
            type:String,
            required:[true,"password is required"]
        },
    vehicleType:[{
        type:Schema.Types.ObjectId,
                    ref:"Vehicle"
    }]
},{timestamps:true})


export const User = mongoose.model("User",userSchema)
