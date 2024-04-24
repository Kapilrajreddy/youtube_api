import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const video = await Video.findById(videoId)

  if(!video){
    throw new ApiError(404,"Video does not exist")
  }

  const commentAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes.likedBy"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
        isLiked: 1,
      },
    },
  ]);

  const options = {
    page:parseInt(page,10),
    limit:parseInt(limit,10)
  }

  const comments = await Comment.aggregatePaginate(commentAggregate,options)

  return res 
  .status(200)
  .json(new ApiResponse(200, comments,"Comments fetched Successfully"))


});

const getVideoComments1 = asyncHandler(async (req, res) => {
    const {videoId} = req.params 

    const {page=1, limit=10} = req.query 

    if(!isValidObjectId(videoId)){
      throw new ApiError(400,"Invalid Video Id")
    }

    const isVideoExists = await Video.findById(videoId)

    if(!isVideoExists){
      throw new ApiError(404, "Video not Found")
    }

    const Page = parseInt(page)
    const Limit = parseInt(limit)

    const result = await Comment.aggregate([
      {
        $match: {
          video: new mongoose.Types.ObjectId(videoId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerOfComment",
          pipeline: [
            {
              $project: {
                fullname: 1,
                username: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          ownerOfComment: { $first: "$ownerOfComment" },
        },
      },
      {
        $facet: {
          comments: [
            {
              $skip: (Page - 1) * Limit,
            },
            { $limit:Limit },
            {
              $sort:{
                createdAt:-1
              }
            }
          ],
          totalComments:[
            {$count:"count"}
          ]
        },
      },
    ]);

    console.log(result,"result")

    try{
      const comments = result[0].comments
      console.log(comments)
      const commentsOnPage = comments.lenth 
      
      const totalComments = result[0].totalComments[0]?.count||0 

      console.log(totalComments);

      if(comments.length===0){
        return res.status(200).json(new ApiResponse(200,{},"User does not have comments"))
      }
      else{
        return res
        .status(200)
        .json(new ApiResponse(200,{comments,commentsOnPage,totalComments},"Comments fetched Successfully"))
      }


    }catch(error){
      throw new ApiError(400,error.message||"something went wrong")
    }
})

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video

  const {videoId} = req.params 
  const {content} = req.body 

  if(!content){
    throw new ApiError(400,"Content is required")
  }

  const video = await Video.findById(videoId)

  if(!video){
    throw new ApiError(404, "Video not found")
  }

  const comment = await Comment.create({
    content, video:videoId,owner:req.user?._id
  })

  if(!comment){
    throw new ApiError(500, "Failed to add comment")
  }

  return res
  .status(200)
  .json(new ApiResponse(201, comment,"Comment added successfully"))

});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment

  const {commentId} = req.params 
  const {content} = req.body

  console.log(commentId)

  if(!content){
    throw new ApiError(400, "Content is Required")
  }

  const comment = await Comment.findById(commentId)

  if(!comment){
    throw new ApiError(404,"Comment not found")
  }

  

  if(comment?.owner.toString()!==req.user?._id.toString()){
    throw new ApiError(400,"Only comment owner can edit their comment")
  }

  const commentUpdate = await Comment.findByIdAndUpdate(
    comment?._id,
    {
      $set: {
        content
      },
    },
    {
      new: true,
    }
  );

  if(!commentUpdate){
    throw new ApiError(500,"Failed to edit comment")
  }

  return res 
  .status(200)
  .json(new ApiResponse(200,updateComment,"Comment Updated Successfully"))

});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment

  const {commentId} = req.params

  const comment = await Comment.findById(commentId)

  if(!comment){
    throw new ApiError(404, "Comment not found")
  }

  if(comment?.owner.toString()!==req.user?._id.toString()){
    throw new ApiError(400,"Only owner can delete the comment")
  }

  await Comment.findByIdAndDelete(commentId)

  await Like.deleteMany({
    comment:commentId,
    likedBy:req.user
  })

  return res 
  .status(200)
  .json(
    new ApiResponse(200,{commentId},"Comment Deleted Successfully")
  )

});

const addTweetComment = asyncHandler(async(req,res)=>{
  const {tweetId} = req.params 
  const {content} = req.body 

  const user = await User.findById(req.user?._id)

  if(!user){
    throw new ApiError(404,"User Not Found")
  }

  if(!isValidObjectId(tweetId)){
    throw new ApiError(400,"Invalid TweerId")
  }

  if(!content){
    throw new ApiError(400,"content is Required")
  }

  const tweet = await Tweet.findById(tweetId)

  if(!tweet){
    throw new ApiError(404,"Tweet Not Found")
  }

  const comment = await Comment.create({
    content,
    tweet:tweetId,
    owner:user?._id
  })

  if(comment){
    return res.status(200).json(new ApiResponse(200,comment,"comment created successfully"))

  }else{
    throw new ApiError(500,"Error while creating the comment")
  }

})

const updateCommentAndReply = asyncHandler(async(req,res)=>{
  const {commentId} = req.parsms 
  const {content} = req.body

  if(!isValidObjectId(commentId)){
    throw new ApiError(402,"invalid comment Id")
  }

  if(!content){
    throw new ApiError(400,"Content is Required")
  }

  const comment = await Comment.findById(commentId)

  if(!comment){
    throw new ApiError(400,"Comment is not found")
  }

  const updateComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );

  if(!updateComment){
    throw new ApiError(500,"Error While updating comment")
  }

  return res.status(200)
  .json(new ApiResponse(200,updateComment,"comment updated successfully"))


})

const addReply = asyncHandler(async(req,res)=>{
  const {commentId} = req.params 
  const {content} = req.body

  const user = await User.findById(req.user?._id)

  if(!user){
    throw new ApiError(404,"User not found")
  }

  if(!isValidObjectId(commentId)){
    throw new ApiError(400,"Invalid Comment Id")
  }

  const isCommentExist = await Comment.findById(commentId)

  if(!isCommentExist){
    throw new ApiError(404,"Comment not Found")
  }

  if(!content){
    throw new ApiError(400,"Content is Required")
  }

  const reply = await Comment.create({
    content,
    comment:commentId,
    owner:user?._id
  })

  if(reply){
    return res.status(200).json(new ApiResponse(200,reply,"Reply cretaed successfully"))
  }
  else{
    throw new ApiError(500,"Error while creating the reply")
  }

})

const getAllReplies = asyncHandler(async(req,res)=>{
  const {commentId} = req.params 
  const {page=1,limit=10} = req.query 


  if(!isValidObjectId(commentId)){
    throw new ApiError(400,"Invalid commentId")
  }

  const isCommentExists = await Comment.findById(commentId)

  if(!isCommentExists){
    throw new ApiError(400,"Comment not Found")
  }

  const Page = parseInt(page)
  const Limit = parseInt(limit)

  const result = await Comment.aggregate([
    {
      $match:{
        comment:new mongoose.Types.ObjectId(commentId)
      }
    },
    {
      $lookup:{
        from:"users",
        localField:"owner",
        foreignField:"_id",
        as:"ownerOfReply",
        pipeline:[
          {
            $project:{
              fullname:1,
              username:1,
              avatar:1
            }
          }
        ]
      }
    },
    {
      $addFields:{
        ownerOfReply:{$first:"$ownerOfReply"}
      }
    },
    {
      $facet:{
        replies:[
          {$skip:(Page-1)*Limit},
          {$limit:Limit},
          {$sort:{
            createdAt:-1
          }}
        ],
        totalReplies:[
          {$count:"count"}
        ]
      }
    }
  ])

  try{
    const replies = result[0].replies 
    const repliesOnPage = replies.length 
    const totalreplies = result[0].totalReplies[0]?.count||0;

    if(replies.length===0){
      return res.status(200).json(new ApiResponse(200,{},"User does not have replies"))
    }else{
      return res.staus(200).json(new ApiResponse(200,{replies,repliesOnPage,totalreplies},"Replies fetched successfully"))
    }
  }catch(error){
    throw new ApiError(400,error.message||"Something went wrong")
  }

})

export {
  getVideoComments,
  getVideoComments1,
  addComment,
  updateComment,
  deleteComment,
  addTweetComment,
  addReply,
  getAllReplies,
};
