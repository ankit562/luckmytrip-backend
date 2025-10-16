import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.CORS_ORIGIN : "http://localhost:5173",
  credentials: true
}));

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "2mb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes imports
import authUserRouter from "./routers/authUserRouter.js";
import ticketRouter from './routers/ticketRouter.js';
import productRouter from './routers/productRouter.js';
import contactUsInfoRouter from "./routers/ContactUsInfoRouter.js"



//routes declaration
app.use("/api/v1/auth" ,authUserRouter)
app.use("/api/v1/tickets" ,ticketRouter)
app.use("/api/v1/products" ,productRouter)
app.use("/api/user-info", contactUsInfoRouter);



export {app}