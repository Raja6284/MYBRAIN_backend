import mongoose, { Types } from "mongoose"
import {model,Schema} from "mongoose"
import { MONGODB_URI } from "./config"


mongoose.connect(MONGODB_URI)

const userSchema = new Schema({
    username:{type:String,unique:true,required:true},
    password:{type:String, required:true}
})

export  const userModel = model("User",userSchema)


const contentTypes = ["image","video","article","audio","youtube","twitter","instagram","linkedin","text","code","randomLink"]

const contentSchema = new Schema({
    link:{type:String},
    type:{type:String,enum:contentTypes},
    title:{type:String,required:true},
    tags:[{type:Types.ObjectId,ref:'Tag'}],
    userId:[{type:Types.ObjectId,ref:'User',required:true}],
    text:{type:String}
})

export const contentModel = model("Content",contentSchema)


const linkSchema = new Schema({
    hash:String,
    userId:[{type:Types.ObjectId,ref:'User',required:true,unique:true}]
})

export const linkModel = model("Links", linkSchema)