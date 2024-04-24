import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { getWatchHistory } from "./user.controller.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  console.log(req.query)

  const user = await User.findById(userId)

  const pipeline = []

  if(query){
    pipeline.push({
        $search:{
            index:"search-videos",
            text:{
                query:query,
                path:["title","description"]
            }
        }
    })
  }

  if(userId){
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid UserId")
    }
    pipeline.push({
        $match:{
            owner:new mongoose.Types.ObjectId(userId)
        }
    })
  }

  // fetch videos only that are set isPublished as true 
  pipeline.push({$match:{isPublished:true}})

  // sortby can be views createdAt duration 
  //sorttype can be assending or descending 

  if(sortBy && sortType){
    pipeline.push({
        $sort:{
            [sortBy]:sortType==="asc"?1:-1
        }
    })
  }else{
    pipeline.push({$sort:{createdAt:-1}})
  }

  pipeline.push({
    $lookup:{
        from:"users",
        localField:"owner",
        foreignField:"_id",
        as:"ownerDetails",
        pipeline:[
            {
                $project:{
                    username:1,
                    avatar:1
                }
            }
        ]
    }
  },
{
    $unwind:"$ownerDetails"
})

const videoAggregate = Video.aggregate(pipeline)

const options = {
    page:parseInt(page,10),
    limit:parseInt(limit,10)
}

const video = await Video.aggregatePaginate(videoAggregate,options)

return res 
.status(200)
.json(new ApiResponse(200,video,"Video fetched Successfully"))

});

// Second Method
const getAllVideos1 = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  const filter = userId ? { owner: userId } : {};
  const sort = sortBy ? { [sortBy]: sortType === "desc" ? -1 : 1 } : {};
  const videos = await Video.find(filter)
    .skip((Number(page) - 1) * Number(limit))
    .limit(parseInt(limit))
    .sort(sort)
    .exec();
  if (!videos) throw new ApiError("Error in fetching videos");
  return res
    .status(200)
    .json(new ApiResponse(200, { videos }, "Videos fetched successfully"));
});

const getSearchedVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy,
    sortType /*userId*/,
  } = req.query;

  // if (!isValidObjectId(userId)) {
  //     throw new ApiError(401, "Invalid user ID")
  // }
  if (!query || !sortBy || !sortType) {
    throw new ApiError(400, "all fields are required");
  }

  // const user =await User.findById(userId)
  // if (!user) {
  //     throw new ApiError(400, "user not found")
  // }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  await Video.createIndexes({ title: "text", description: "text" });
  const allVideos = await Video.aggregate([
    {
      $match: {
        $text: { $search: query },
      },
    },
    {
      $sort: {
        score: { $meta: "textScore" },
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
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
  ]);

  try {
    const listVideos = await Video.aggregatePaginate(allVideos, options);
    if (listVideos.docs.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "No videos to show"));
    } else {
      return res
        .status(200)
        .json(
          new ApiResponse(200, listVideos, "videos list fetched successfully")
        );
    }
  } catch (error) {
    throw new ApiError(
      400,
      error.message || "something went wrong with paginationn"
    );
  }
});

const getUserSearchedVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy,
    sortType,
    username,
    isPublished,
    query,
  } = req.query;

  if (!username) {
    throw new ApiError(400, "Username is missing");
  }

  if (!query || !sortBy || !sortType) {
    throw new ApiError(400, "all fields are required");
  }

  const user = await User.findOne({ username: username });
  if (!user) {
    throw new ApiError(400, "user not found");
  }

  const Page = parseInt(page);
  const Limit = parseInt(limit);

  const result = await Video.aggregate([
    {
      $search: {
        index: "title-description-search",
        compound: {
          should: [
            {
              autocomplete: {
                query: query,
                path: "title",
                tokenOrder: "any",
                fuzzy: {
                  maxEdits: 1,
                  prefixLength: 1,
                  maxExpansions: 256,
                },
              },
            },
            {
              autocomplete: {
                query: query,
                path: "description",
                tokenOrder: "any",
                fuzzy: {
                  maxEdits: 1,
                  prefixLength: 1,
                  maxExpansions: 256,
                },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    },
    {
      $match: {
        owner: new mongoose.Types.ObjectId(user?._id),
        isPublished: isPublished === "true" ? true : false,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerOfVideo",
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
        ownerOfVideo: { $first: "$ownerOfVideo" },
      },
    },
    {
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        createdAt: 1,
        ownerOfVideo: 1,
        isPublished: 1,
        "thumbnail.url": 1,
        score: { $meta: "searchScore" },
      },
    },
    {
      $facet: {
        videos: [
          { $skip: (Page - 1) * Limit },
          { $limit: Limit },
          {
            $sort: {
              score: -1,
              [sortBy]: sortType === "asc" ? 1 : -1,
            },
          },
        ],
        totalVideos: [{ $count: "count" }],
      },
    },
  ]);
  try {
    const videos = result[0].videos;
    const videosOnPage = videos.length;
    const totalVideos = result[0].totalVideos[0]?.count || 0;

    if (videos.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Videos not found "));
    } else {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { videos, videosOnPage, totalVideos },
            "Videos list fetched successfully"
          )
        );
    }
  } catch (error) {
    throw new ApiError(400, error.message || "Something went wrong");
  }
});


const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  console.log(req.body,"kapil")

  if([title,description].some((field)=>field?.trim()==="")){
    throw new ApiError(400, "All fields are required")
  }

  const videoFileLocalPath = req.files?.videoFile[0].path; 
  const thumbnailLocalPath = req.files?.thumbnail[0].path;

  console.log(videoFileLocalPath, "videoFileLocalPath");

  if(!videoFileLocalPath){
    throw new ApiError(400,"VideoFileLocalPath is required")
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "VideoFileLocalPath is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath)
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

  console.log(videoFile, "videoFile");

  if(!videoFile){
    throw new ApiError(400,"Video File is not Found")
  }

  if (!thumbnail) {
    throw new ApiError(400, "thumbnail File is not Found");
  }

  const video = await Video.create({
    title,
    description,
    duration:videoFile.duration,
    videoFile:{
        url:videoFile.url, 
        public_id:videoFile.public_id
    },
    thumbnail:{
        url:thumbnail.url,
        public_id:thumbnail.public_id
    },
    owner:req.user?._id,
    isPublished:false
  })

  const videoUploaded = await Video.findById(video._id)

  if(!videoUploaded){
    throw new ApiError(500,"Videoupload failed")
  }

  return res 
  .status(200)
  .json(new ApiResponse(200,video,"Video Uploaded successfully"))

});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id

  console.log(videoId, "videoId");

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }

  console.log(req.user,"kapil");

  if (!isValidObjectId(req.user?._id)) {
    throw new ApiError(400, "Invalild UserId");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
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
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);

  if (!video) {
    throw new ApiError(500, "Failed to fetch video");
  }

  // increment views if video fetched successfully

  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });


  await User.findByIdAndUpdate(req.user?._id,{
    $addToSet:{
        watchHistory:videoId
    }
  })

  console.log(video,"video")

  return res
  .status(200)
  .json(new ApiResponse(200,video[0],"Video details fetched successfully"))

});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail

  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }

  if (!(title && description)) {
    throw new ApiError(400, "Title and Description Fields are Required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "No Video found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't edit this video as you are not the owner"
    );
  }

  //deleting old thumbnail and updating with new one 
  const thumbnailToDelete = video.thumbnail.public_id;
  const thumbnailLocalPath = req.file?.path

  if(!thumbnailLocalPath){
    throw new ApiError(400,"thumbnail is required")
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

  if(!thumbnail){
    throw new ApiError(400,"thumbnail not found")
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set:{
        title,
        description,
        thumbnail:{
          url:thumbnail.url,
          public_id:thumbnail.public_id
        }
      }
    },
    {
      new:true
    }
  )
  if(!updatedVideo){
    throw new ApiError(500,"Failed to update video")
  }

  if(updatedVideo){
    await deleteOnCloudinary(thumbnailToDelete)
  }

  return res 
  .status(200)
  .json(new ApiResponse(200,updateVideo,"Video updated Successfully"))

});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video

  if(!isValidObjectId(videoId)){
    throw new ApiError(400,"Invalid VideoId")
  }

  const video = await Video.findById(videoId)

  if(!video){
    throw new ApiError(404,"No Video found")
  }

  if(video?.owner.toString()!==req.user?._id.toString()){
    throw new ApiError(400,"You can't the delete the video as you are not the owner")
  }

  const videoDeleted = await Video.findByIdAndDelete(video?._id)

  if(!videoDeleted){
    throw new ApiError(400,"Failed to delete the video")
  }

  await deleteOnCloudinary(video.thumbnail.public_id)
  await deleteOnCloudinary(video.videoFile.public_id,"video")

  await Like.deleteMany({
    video:videoId
  })

  await Comment.deleteMany({
    video: videoId,
  });

  return res 
  .status(200)
  .json(new ApiResponse(200,{},"Video Deleted successfully"))

});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if(!isValidObjectId(videoId)){
    throw new ApiError(400,"Invalid videoId")
  }

  const video = await Video.findById(videoId)

  if(!video){
    throw new ApiError(404,"Video not found")
  }

  if(video?.owner.toString()!==req.user?._id.toString()){
    throw new ApiError(400, "You can't toggle publish status as you are not the owner")
  }

  const toggledVideoPublish = await Video.findByIdAndUpdate(
    videoId,
    {
      $set:{
        isPublished:!video?.isPublished
      }
    },
    {
      new :true
    }
  )
  if(!toggledVideoPublish){
    throw new ApiError(500,"Failed to toggle publish status")
  }

  return res 
  .status(200)
  .json(new ApiResponse(200,{isPublished:toggledVideoPublish.isPublished},
    "Video publish toggled successfully"
  ))

});

export {
  getAllVideos,
  getAllVideos1,
  getSearchedVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  getUserSearchedVideos,
};
