import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription

  console.log("hello")
  const {username} = req.params 

  const user = await User.findById(req.user?._id)

  console.log(user,username,"user")

  if(!user){
    throw new ApiError(400,"user not found")
  }

  if(!username){
    throw new ApiError(400,"Username not Found")
  }

  const channel = await User.findOne({username:username})

  console.log(channel,"channel")

  if(!channel){
    throw new ApiError(401,"Channel does not exist")
  }

  try{
    const isSubscribedTo = await Subscription.findOne({
        channel:channel?._id,
        subscriber:user?._id
    })

    console.log(isSubscribedTo,"isSubscribedTo")

    if(!isSubscribedTo){
        const createSubscription = await Subscription.create({
            channel:channel?._id,
            subscriber:user?._id
        })

        if(!createSubscription){
            throw new ApiError(404,"Error while subscribing")
        }

        res
        .status(200)
        .json(new ApiResponse(200,createSubscription,"SUbscribed to channel successfully"))
    }
    else{
        const removeSubscription = await Subscription.findOneAndDelete({
            channel:channel?._id,
            subscriber:user?._id 

        })
        if(!removeSubscription){
            throw new ApiError(200,removeSubscription,"Unsubscribed to channel Successfully")
        }
    }
  }catch(error){
    throw new ApiError(404,error.message)
  }

});


const toggleSubscription1 = asyncHandler(async (req, res) => {
    const {channelId} = req.params 

   
    
    if(!isValidObjectId(channelId)){
      throw new ApiError(400,"Invalid ChannelId")
    }

   console.log(Subscription,"Subscription")
     
    const isSubscribed = await Subscription.findOne({
      subscriber:req.user?._id,
      channel:channelId
    })

    console.log(isSubscribed,"isSub")

    if(isSubscribed){
      await Subscription.findByIdAndDelete(isSubscribed?._id)
      return res
      .status(200)
      .json(new ApiResponse(200,{subscribed:false},"Unsubscribe Successfully"))
    }

    const a = await Subscription.create({
      subscriber:req.user?._id,
      channel:channelId
    })

    console.log(a,"a")

    return res
    .status(200)
    .json(
      new ApiResponse(200,{subscribed:true},"subscribed successfully")
    )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  let { channelId } = req.params;

  console.log(channelId,"channelId")

  if(!isValidObjectId(channelId)){
    throw new ApiError(400,"Invalid ChannelId")
  }

  channelId = new mongoose.Types.ObjectId(channelId);
  console.log(channelId, "channelId");

  const subscribers = await Subscription.aggregate([
    {
      $match:{
        channel:channelId
      }
    },
    {
      $lookup:{
        from:"users",
        localField:"subscriber",
        foreignField:"_id",
        as:"subscriber",
        pipeline:[
          {
            $lookup:{
              from:"subscriptions",
              localField:"_id",
              foreignField:"channel",
              as: "subscribedToSubscriber"
            }
          },
          {
            $addFields:{
              subscribedToSubscriber:{
                $cond:{
                  if:{
                    $in:[channelId,"$subscribedToSubscriber.subscriber"]
                  },
                  then:true,
                  else:false
                }
                
                
              },
              subscribersCount:{
                $size:"$subscribedToSubscriber"
              }
            }
          }
        ]
      }
    },
    {
      $unwind:"$subscriber"
    },{
      $project:{
        _id:0,
        subscriber:{
          _id:1,
          username:1,
          fullname:1,
          "avatar.url":1,
          subscribedToSubscriber:1,
          subscribersCount:1
        }
      }
    }
  ])

  return res
  .status(200)
  .json(new ApiResponse(200, subscribers,"subscribers fetched successfully"))

});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if(!subscriberId){
    throw new ApiError(400,"subscriber id is required")
  }


  const subscribedChannels = await Subscription.aggregate([
    {
      $match:{
        subscriber:new mongoose.Types.ObjectId(subscriberId)
      }
    },
    {
      $lookup:{
        from:"users",
        localField:"channel",
        foreignField:"_id",
        as:"subscribedChannel",
        pipeline:[
          {
            $lookup:{
              from:"videos",
              localField:"_id",
              foreignField:"owner",
              as:"videos"
            }
          },
          {
            $addFields:{
              latestVideo:{
                $last:"$videos"
              }
            }
          }
        ]
      }
    },
    {
      $unwind:"$subscribedChannel"
    },
    {
      $project:{
        _id:0,
        subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    latestVideo: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        owner: 1,
                        title: 1,
                        description: 1,
                        duration: 1,
                        createdAt: 1,
                        views: 1
                    },
                },
            
      }
    }
  ])

  return res 
  .status(200)
  .json(new ApiResponse(200,subscribedChannels,"subscribed channels fetched successfully"))

});

export { toggleSubscription,toggleSubscription1, getUserChannelSubscribers, getSubscribedChannels };
