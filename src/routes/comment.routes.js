import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { addComment, addReply, addTweetComment, deleteComment, getVideoComments, getVideoComments1, updateComment } from "../controllers/comment.controller.js";

const router = Router();

router
  .route("/get-video-comments/:videoId")
  .get(verifyJWT, getVideoComments1);

router.route("/add-comment/:videoId").post(verifyJWT,addComment)
router.route("/update-comment/:commentId").patch(verifyJWT, updateComment);
router.route("/delete-comment/:commentId").delete(verifyJWT, deleteComment);
router.route("/add-comment-reply/:commentId").patch(verifyJWT,addReply)

router.route("/add-tweet-comment/:tweetId").post(verifyJWT,addTweetComment);

export default router