import express from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { contentModel, linkModel, userModel } from "./db";
import { JWT_PASSWORD } from "./config";
import { userMiddleware } from './middleware';
import { random } from "./utils";
import cors from "cors"
import bcrypt from 'bcrypt'
import { Request, Response } from "express";

const app = express();
app.use(express.json())

app.use(cors({
    origin: "*", // Allow all origins (for testing)
    credentials: true
}));


async function hashPassword(password: string) {
    try {
        const saltRounds = 10;
        //const salt = await bcrypt.genSalt(saltRounds); //no need for genratin salt, bcrypt.hash() interanlly maintains this
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (err) {
        console.error("Error hashing password:", err);
        throw new Error("Hashing failed");
    }
}


app.post("/api/v1/signup", async (req: Request, res: Response): Promise<any> => {

    //TODO: zod validation,hash the password , add all status code which is required
    try {
        const username = req.body.username
        const password = req.body.password

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const existingUser = await userModel.findOne({ username })
        if (existingUser) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        const hashedPassword = await hashPassword(password)

        await userModel.create({
            username: username,
            password: hashedPassword
        })
        console.log(hashedPassword)
        res.json({
            message: "user Signed up"

        })
    } catch (e) {
        res.status(411).json(
            {
                message: "user already exist"
            }
        )
    }

})


app.post("/api/v1/signin", async (req, res): Promise<any> => {

    try {
        const username = req.body.username
        const password = req.body.password

        const existingUser = await userModel.findOne({
            username,
        })

        if (!existingUser) {
            return res.status(403).json({
                message: "User does not exist"
            })
        }

        const isMatch = bcrypt.compare(password, existingUser.password)
        if (!isMatch) {
            return res.status(403).json({ message: "Invalid password" });
        }


        const token = jwt.sign({
            id: existingUser._id
        }, JWT_PASSWORD)

        res.json({
            token
        })

    } catch (error) {
        console.log("signup Error : ", error)
        res.status(500).json({
            message: "Internal sever error"
        })
    }

})




app.post("/api/v1/content", userMiddleware, async (req, res) => {
    try {

        const link = req.body.link
        const title = req.body.title
        const type = req.body.type
        const text = req.body.text

        const content = await contentModel.create({
            link,
            type,
            title,
            text,
            tags: [],
            //@ts-ignore
            userId: req.userId

        })

        res.status(200).json({
            message: "content added"
        })
    } catch (err) {
        console.log("An error occured while adding content " + err)
        res.status(500).json({
            messsage:"internal server error"
        })
    }
})

app.get("/api/v1/content", userMiddleware, async (req, res) => {

    try {
        //@ts-ignore
        const userId = req.userId
        const content = await contentModel.find({
            userId: userId
        }).populate("userId", "username")

        res.json({
            content
        })
    } catch (error) {
        console.error("Error fetching content:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})



app.delete("/api/v1/content", userMiddleware, async (req, res) => {

    try{
        const contentId = req.body.contentId

    await contentModel.deleteOne({
        _id: contentId,
        //@ts-ignore
        userId: req.userId
    })

    res.json({
        message: "deleted"
    })
    }catch(error){
        console.log("error deleting content : " , error)
        res.status(500).json({
            message:"internal server error"
        })
    }
    
})

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {

    try {
        const share = req.body.share

        if (share) {

            const existingLink = await linkModel.findOne({
                //@ts-ignore
                userId: req.userId
            })

            if (existingLink) {
                res.json({
                    hash: existingLink.hash
                })

                return;
            }

            const hash = random(10)
            await linkModel.create({
                //@ts-ignore
                userId: req.userId,
                hash: hash
            })

            res.json({
                hash: hash
            })

        } else {
            await linkModel.deleteOne({
                //@ts-ignore
                userId: req.userId
            })

            res.json({
                message: "removed link"
            })
        }
    } catch (error) {
        console.log("error while generating link ", error)
        res.status(500).json({
            message:"internal server errro"
        })
    }

})

app.get("/api/v1/brain/:shareLink", async (req, res) => {

    try{
        const hash = req.params.shareLink
    //console.log(hash)
    const link = await linkModel.findOne({
        hash
    })

    if (!link) {
        res.status(411).json({
            message: "sorry wrong input"
        })
        return
    }

    const content = await contentModel.find({
        userId: link.userId
    })

    const user = await userModel.findOne({
        _id: link.userId
    })

    if (!user) {
        res.status(411).json({
            message: "user not found, ideally this error should not be occuring here, if this line prints, some thing is wrong anywhere"
        })
        return
    }

    res.json({
        username: user.username,
        content: content
    })
    }catch(error){
        console.log("error while loading content ")
        res.status(500).json({
            message:"interanal server errror"
        })
    }
    
})



const PORT = 3000
app.listen(PORT, () => {
    console.log(`app is running on http://localhost:${PORT}`)
})