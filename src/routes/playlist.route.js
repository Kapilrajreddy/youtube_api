import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { addVideoToPlaylist, createPlaylist, deletePlaylist, getPlayListById, getUserPlaylists, removeVideoFromPlaylist, updatePlayList } from "../controllers/playlist.controller.js";


const router = Router();

router.route("/create-playlist").post(verifyJWT, createPlaylist);
router.route("/update-playlist/:playlistId").post(verifyJWT, updatePlayList);
router.route("/delete-playlist/:playlistId").delete(verifyJWT, deletePlaylist);
router.route("/add-video-to-playlist/:playlistId/:videoId").post(verifyJWT,addVideoToPlaylist)
router
  .route("/remove-video-from-playlist/:playlistId/:videoId")
  .patch(verifyJWT, removeVideoFromPlaylist);

router.route("/get-playlist-by-id/:playlistId").get(verifyJWT,getPlayListById)
router.route("/get-user-playlist/:userId").get(verifyJWT,getUserPlaylists)

export default router