import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getSubscribedChannels, getUserChannelSubscribers, toggleSubscription, toggleSubscription1 } from "../controllers/subscription.controller.js";

const router = Router();

router.route("/toggle-subscription/:username").post(verifyJWT, toggleSubscription);
router
  .route("/toggle-subscriptions/:channelId")
  .post(verifyJWT, toggleSubscription1);

router
  .route("/get-channel-subscribers/:channelId")
  .get(verifyJWT, getUserChannelSubscribers);


router
  .route("/get-subscribed-channels/:subscriberId")
  .get(verifyJWT, getSubscribedChannels);

export default router