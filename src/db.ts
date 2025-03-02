import mongoose, { Types } from "mongoose"
import {model,Schema} from "mongoose"
import { mongoURI } from "./config"


mongoose.connect(mongoURI)



const userSchema = new Schema({
    username:{type:String,unique:true,required:true},
    password:{type:String, required:true}
})

export  const userModel = model("User",userSchema)


const contentTypes = ["image","video","article","audio","youtube","twitter"]

const contentSchema = new Schema({
    link:{type:String,required:true},
    type:{type:String,enum:contentTypes},
    title:{type:String,required:true},
    tags:[{type:Types.ObjectId,ref:'Tag'}],
    userId:[{type:Types.ObjectId,ref:'User',required:true}]
})

export const contentModel = model("Content",contentSchema)


const linkSchema = new Schema({
    hash:String,
    userId:[{type:Types.ObjectId,ref:'User',required:true,unique:true}]
})

export const linkModel = model("Links", linkSchema)