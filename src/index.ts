import dotenv from 'dotenv';
dotenv.config();

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
import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "./config";
import { GOOGLE_CLIENT_SECRET } from "./config";
import rateLimit from "express-rate-limit";



const app = express();
app.use(express.json({ limit: '10kb' }));

// app.use(cors({
//     origin: "*", // Allow all origins (for testing)
//     credentials: true
// }));


app.use(cors({
    origin: ["http://localhost:5173", "http://192.168.29.207:5173"], // Add all your frontend URLs
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));


const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per window
    message: "Too many requests from this IP, please try again after 15 minutes.",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
  
app.use("/api/v1/signup", authLimiter);
app.use("/api/v1/signin", authLimiter);

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


const client = new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:5173" // Match your frontend exactly
  });

// Backend fix for google-signin endpoint
app.post("/api/v1/google-signin", async (req, res):Promise<any> => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Authorization code is required" });
      }
      
      console.log("Received code:", code);
      
      // Exchange code for tokens
      try {
        const { tokens } = await client.getToken(code);
        console.log("Got tokens:", Object.keys(tokens));
        
        if (!tokens.id_token) {
          return res.status(400).json({ message: "No ID token received" });
        }
        
        // Verify ID token
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        console.log("Payload received:", payload);
        
        if (!payload || !payload.name) {
          return res.status(400).json({ message: "Invalid user data" });
        }
        
        // Find or create user
        let user = await userModel.findOne({ username: payload.name });
        
        if (!user) {
          console.log("Creating new user:", payload.name);
          user = await userModel.create({
            username: payload.name,
            password: payload.sub// For Google auth users
          });
        } else {
          console.log("Found existing user:", payload.name);
        }
        
        // Generate JWT
        const token = jwt.sign({ id: user._id }, JWT_PASSWORD);
        return res.json({ token });
        
      } catch (tokenError) {
        console.error("Token exchange error:", tokenError);
        return res.status(400).json({ 
          message: "Failed to exchange code for token", 
          tokenError
        });
      }
      
    } catch (error) {
      console.error("Google sign-in error:", error);
      return res.status(500).json({ message: "Internal server error", error });
    }
  });


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

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ message: "Username must be 3-20 characters" });
          }
        if (password.length < 8) {
        return res.status(400).json({ message: "Password must be ≥8 characters" });
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


app.get("/api/v1/user",userMiddleware,async(req,res):Promise<any> =>{
    try{

      //@ts-ignore
    const userId = req.userId
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const username = user.username
    res.json({
        username
    })

    }catch(error){
        console.error('Error fetching user', error);
      return res.status(500).json({ message: 'Internal server error', error });
    }
})


app.post("/api/v1/content", userMiddleware, async (req, res):Promise<any> => {
    try {

        const link = req.body.link
        const title = req.body.title
        const type = req.body.type
        const text = req.body.text

        if (text && text.length > 10_000) {
            return res.status(413).json({ message: "Text exceeds 10,000 characters" });
          }

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


app.put('/api/v1/content/:id',userMiddleware, async (req, res):Promise<any> => {
    try {

    //@ts-ignore
    const userId = req.userId
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
  
      const contentId = req.params.id;
      
      // Find content by ID and check if it belongs to the user
      const existingContent = await contentModel.findOne({ 
        _id: contentId,
        userId: userId
      });
  
      if (!existingContent) {
        return res.status(404).json({ message: 'Content not found or not authorized' });
      }
  
      // Update fields based on content type
      const updateData = {};
      
      // Always update title if provided
      if (req.body.title) {
        //@ts-ignore
        updateData.title = req.body.title;
      }
      
      // Update type-specific fields
      if (existingContent.type === 'text' || existingContent.type === 'code') {
        if (req.body.text !== undefined) {
            //@ts-ignore
          updateData.text = req.body.text;
        }
      } else if (['youtube', 'twitter', 'linkedin', 'instagram', 'randomLink'].includes
        //@ts-ignore
        (existingContent.type)) {
        if (req.body.link) {
            //@ts-ignore
          updateData.link = req.body.link;
        }
      }
      
      // Update the content
      const updatedContent = await contentModel.findByIdAndUpdate(
        contentId,
        { $set: updateData },
        { new: true } // Return the updated document
      );
  
      return res.status(200).json(updatedContent);
    } catch (error) {
      console.error('Error updating content:', error);
      return res.status(500).json({ message: 'Internal server error', error });
    }
  });



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