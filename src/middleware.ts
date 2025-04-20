import { Request,Response,NextFunction } from "express";
import { JWT_PASSWORD } from "./config";
import jwt from "jsonwebtoken"

export const userMiddleware = (req:Request,res:Response,next:NextFunction)=>{
        //const header = req.headers(["authorized"])
        const header = req.headers["authorization"]
        // if(!header){
        //     return res.status(401).json({
        //         message:"you are not logged in"
        //     })
        // }
        //console.log(header) 
        const decoded = jwt.verify(header as string,JWT_PASSWORD)

        if(decoded){
            //@ts-ignore
            req.userId = decoded.id
            next()
        }else{
            res.status(403).json({
                message:"you are not logged in"
            })
        }

}




// import { Request, Response, NextFunction } from "express";
// import { JWT_PASSWORD } from "./config";
// import jwt from "jsonwebtoken";

// // Extend the Request interface to include userId
// interface AuthRequest extends Request {
//   userId?: string;
// }

// export const userMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
//   // Get the Authorization header
//   const token = req.headers["authorization"];

//   // Check if the token exists
//   if (!token) {
//     return res.status(401).json({
//       message: "No token provided",
//     });
//   }

//   try {
//     // Verify the token (assuming it's the raw JWT)
//     const decoded = jwt.verify(token, JWT_PASSWORD) as { id: string };

//     // Attach userId to the request
//     req.userId = decoded.id;
//     next();
//   } catch (error) {
//     // Handle invalid or expired tokens
//     return res.status(403).json({
//       message: "Invalid or expired token",
//     });
//   }
// };