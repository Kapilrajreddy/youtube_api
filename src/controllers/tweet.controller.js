import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../models/tweet.model.js";
import mongoose, { isValidObjectId } from "mongoose";


const createTweet = asyncHandler(async(req,res)=>{
    const {content} = req.body

    if(!content){
        throw new ApiError(400,"Content is Required")
    }

    const tweet = await Tweet.create(
        {content,
        owner:req.user?._id
        }
    )

    if(!tweet){
        throw new ApiError(500,"Error While creating Tweet")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,tweet,"Tweet Added successfully"))

})

const updateTweet = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params 
    const {content} = req.body 

    if(!content){
        throw new ApiError(400, "Content is Required");
    }

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid tweetId")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404, "Tweet not Found")
    }
    
    if(tweet?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(400,"Only owner can update tweet")
    }

    const newTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set:{
                content
            }
        },
        {
            new:true
        }
    )

    if(!newTweet){
        throw new ApiError(500,"Error While Updating tweet")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,newTweet,"Tweet Updated Successfully"))

})

const deleteTweet = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params 

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid Tweet Id")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404,"Tweet Not Found")
    }

    if(tweet?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(400, "only owner can delete their tweet")
    }

    const deleteTweet = await Tweet.findByIdAndDelete(tweet?._id)

    if(!deleteTweet){
        throw new ApiError(500,"Error While deleting Tweet")
    }

    return res 
    .status(200)
    .json(new ApiResponse(200,{tweetId},"Tweet Deleted Successfully"))

})

const getUserTweets = asyncHandler(async(req,res)=>{
    const {userId} = req.params 

    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid userId")
    }

    const tweets = await Tweet.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeline:[
                    {
                        $project:{
                            username:1,
                            "avatar.url":1
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"tweet",
                as:"likeDetails",
                pipeline:[
                    {
                        $project:{
                            likedBy:1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size:"$likeDetails"
                },
                ownerDetails:{
                    $first:"$ownerDetails"
                },
                isLiked:{
                    $cond:{
                        if:{$in: [req.user?._id, "$likeDetails.likedBy"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $sort:{
                createdAt:-1
            }
        },
        {
            $project:{
                content:1,
                ownerDetails:1,
                likesCount:1,
                createdAt:1,
                isLiked:1
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200,tweets,"Tweets fetched successfully"))
})

export { createTweet, updateTweet, deleteTweet, getUserTweets };