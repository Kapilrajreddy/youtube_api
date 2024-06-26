import express from 'express'
import cors from 'cors'

import cookieParser from 'cookie-parser'

const app = express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


// routes import  

import userRouter from './routes/user.routes.js'
import videoRouter from "./routes/video.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import commentRouter from "./routes/comment.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import likeRouter from "./routes/like.route.js"
import playlistRouter from "./routes/playlist.route.js"
import dashboardRouter from "./routes/dashboard.routes.js"

app.use('/api/v1/user',userRouter)
app.use('/api/v1/video',videoRouter)
app.use("/api/v1/user", subscriptionRouter);
app.use("/api/v1/user", commentRouter);
app.use("/api/v1/user", tweetRouter);
app.use("/api/v1/user", likeRouter);
app.use("/api/v1/user", playlistRouter);
app.use("/api/v1/user", dashboardRouter);

export {app}