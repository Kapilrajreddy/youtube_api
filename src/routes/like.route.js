import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import { getLikedVideos, toggleTweetLike, toggleVideoLike } from "../controllers/like.controller.js";



const router = Router();  

router.route("/toggle-video-like/:videoId").post(verifyJWT,toggleVideoLike)
router.route("/toggle-tweet-like/:tweetId").post(verifyJWT, toggleTweetLike);
router.route("/liked-videos").get(verifyJWT,getLikedVideos)

export default router