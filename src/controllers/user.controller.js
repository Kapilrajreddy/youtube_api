import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'


const generateAccessAndRefreshTokens = async(userId)=>{
     try {
       const user = await User.findById(userId);
       const accessToken = user.generateAccessToken();
       const refreshToken = user.generateRefreshToken();

       user.refreshToken = refreshToken;
       await user.save({ validateBeforeSave: false });

       return { accessToken, refreshToken };
     } catch (error) {
       throw new ApiError(
         500,
         "Something went wrong while generating referesh and access token"
       );
     }
}

const registerUser = asyncHandler(async(req,res)=>{
    
    // get user details from frontend 
    // validation - not empty 
    // check if user already exists : username, email 
    // check for images, check for avatar 
    // upload them to cloudinary, avatar 
    // create user object - create entry in db 
    // remove password and refreshtoken field from response 
    // check for user creation 
    // return res

    const {fullname,email,password,username} = req.body 
    console.log(fullname, email, password, username);

    const a = [fullname, email, password, username].some(
      (field) => !field?.trim()
    );

    console.log(a, "ram")

    if ([fullname, email, password, username].some((field)=>!(field?.trim()))){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or :[{ username },{ email }]
    })

    console.log(existedUser, "existedUser");

    if(!email.includes('@')){
        throw new ApiError(400, "Please provide valid Email")
    }

    if(existedUser){
        throw new ApiError(409, "User with username or email already exists")
    }

    console.log(req.files)

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath =
      req.files?.coverImage?.length > 0
        ? req.files.coverImage[0].path
        : undefined;


    // let coverImageLocalPath;
    // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.lenth>0){
    //     coverImageLocalPath = req.files.coverImage[0].path
    // }

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    const user =  await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        password,
        email,
        username:username.toLowerCase()
    })

    const userCreated = await User.findById(user._id).select("-password -refreshToken")

    if(!userCreated){
        throw new ApiError(500, "Something went wrong while registering the user!")
    }

    

    return res.status(201).json(
        new ApiResponse(200,userCreated,"User Registered Successfully")
    )
})

const loginUser = asyncHandler(async(req,res)=>{
    // req.body => data 
    // username or email 
    // find the user 
    // password check 
    // access and refresh token 
    // set Cookie

    const {username,email,password} = req.body

    if(!username && !email){
        throw new ApiError(400,"Username or Email is required")
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid User Credentials")
    }

    const {accessToken,refreshToken} =  await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    

    const options = {
        httpOnly:true,
        
    }

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            user:loggedInUser,
            accessToken,
            refreshToken,
          },
          "User Loggedin Successfully"
        )
      );
})

const logoutUser = asyncHandler(async(req,res)=>{
    const kapil = await User.findByIdAndUpdate(req.user._id,
       { $unset: {
                refreshToken: 1 
            }
       },
    {
        new:true
    }
    )
    console.log(kapil,"kpail")
    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(
        200,{},"User Logged Out Successfully"
    ))
})


const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken 

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken._id)
    
        if(!user){
            throw new ApiError(401,"Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is Expired or Used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(200,{accessToken,refreshToken}, "Access Token Refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid Refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body 

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password")
    }


    user.password = newPassword

    await user.save({validateBeforeSave:false})

    return res 
    .status(200)
    .json(new ApiResponse(200,{},"Password modified Successfully"))

})


const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200, req.user,"Current user fetched successfully"))
})


const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname,email} = req.body 
    
    if(!fullname || !email){
        throw new ApiError(400,"All fields are Required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,user,"Account Details Updated Successfully"
    ))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path 
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar File is Missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading Avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Avatar Updated Successfully"));
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image File is Missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading Cover Image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image Updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async(req,res)=>{
  
    const {username} = req.params


    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel = await User.aggregate([
      {
        $match: {
          username: username?.toLowerCase(),
        },
      },
      {
        $lookup: {
          from: "subscription",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },
      {
        $lookup: {
          from: "subscription",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo",
        },
      },
      {
        $addFields:{
            subscribersCount:{
                $size:"$subscribers"
            },
            channelsSubscribedToCount:{
                $size:"$subscribedTo"
            },
            isSubscribed:{
                $cond:{
                    if:{$in: [req.user?._id, "$subscribers.subscribed"]},
                    then:true,
                    else:false
                }
            }
        }
      },
      {
        $project:{
            fullname:1,
            username:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1
        }
      }
    ]);

    if(!channel?.length){
        throw new ApiError(404,"Channel Does not exist")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,channel[0],"User Channel Fetched Successfully"))
})

const getWatchHistory = asyncHandler(async(req,res)=>{
  const user = await User.aggregate([
    {
      $match:{
        _id:new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
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
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res 
  .status(200)
  .json(new ApiResponse(200, user[0].watchHistory,"Watch History Fetched Successfully"))
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};