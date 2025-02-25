import express from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { contentModel, userModel } from "./db";
import { JWT_PASSWORD } from "./config";
import { userMiddleware } from './middleware';

const app = express();
app.use(express.json())



app.post("/api/v1/signup", async(req,res)=>{

    //TODO: zod validation,hash the password , add all status code which is required

    const username = req.body.username
    const password = req.body.password

    try{
        await userModel.create({
            username : username,
            password : password
        })
    
        res.json({
            message:"user Signed up"
        })
    }catch(e){
        res.status(411).json(
            {
                message:"user already exist"
            }
        )
    }
    

})

app.post("/api/v1/signin", async(req,res)=>{

    const username = req.body.username
    const password = req.body.password

    const existingUser = await userModel.findOne({
        username,
        password
    })

    if(existingUser){
        const token = jwt.sign({
            id:existingUser._id
        },JWT_PASSWORD)

        res.json({
            token
        })
    }else{
        res.status(403).json({
            message:"invalid credentials"
        })
    }
})

app.post("/api/v1/content",userMiddleware,async(req,res)=>{
    const link = req.body.link
    const title = req.body.title
    const type = req.body.type

    const content = await contentModel.create({
        link,
        type,
        title,
        tags:[],
        //@ts-ignore
        userId : req.userId
       
    })

    res.status(200).json({
        message:"content added"
    })
})

app.get("/api/v1/content",userMiddleware,async(req,res)=>{
    //@ts-ignore
    const userId = req.userId
    const content = await contentModel.find({
        userId:userId
    }).populate("userId", "username")

    res.json({
        content
    })
})

app.delete("/api/v1/content",(req,res)=>{

    const contentId = req.body.contentId

    contentModel.deleteMany({
        contentId,
        //@ts-ignore
        userId : req.userId
    })

    res.json({
        message:"deleted"
    })
})

app.post("/api/v1/brain/share",(req,res)=>{

})

app.post("/api/v1/brain/:shareLink",(req,res)=>{

})



const PORT = 3000
app.listen(PORT,()=>{
    console.log(`app is running on http://localhost:${PORT}`)
})