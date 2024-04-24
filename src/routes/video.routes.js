import { Router } from "express";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { deleteVideo, getAllVideos, getAllVideos1, getSearchedVideos, getVideoById, publishAVideo, togglePublishStatus, updateVideo } from "../controllers/video.controller.js";

const router = Router();

router.route("/get-videos").get(getSearchedVideos)
router.route("/publish-video").post(
  verifyJWT,
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  publishAVideo
);

router.route("/get-video-by-id/:videoId").get(verifyJWT,getVideoById);


router.route("/update-video/:videoId").patch(verifyJWT,upload.single("thumbnail"),updateVideo)
router
  .route("/delete-video/:videoId")
  .delete(verifyJWT,deleteVideo);

router.route("/publish-video/:videoId").patch(verifyJWT, togglePublishStatus);

export default router