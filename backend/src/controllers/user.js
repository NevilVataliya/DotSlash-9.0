import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../models/User.js";
import { ApiResponse } from "../../utils/ApiResponse.js";


const generateAccessAndRefreshToken = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave: false})  
        return {accessToken,refreshToken}
    }catch(error){
        throw new ApiError(500,"something went wrong while generating token")
    }
}

const registerUser = asyncHandler(async(req ,res)=>{
    const {fullName, email,username,password } = req.body
    
    console.log(req.body)
    if(
        [fullName,email,username,password].some((field)=>
        field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }
    // console.log(fullName,email,username,password)
    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409, "User already exists")
    }

    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        password,

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering")
    }
    
    return res.status(201).json(
        new ApiResponse(200,createdUser, "user registered successfully")
    )
})

const loginUser = asyncHandler(async(req,res)=>{
    const {email,username,password} = req.body
    console.log(req.body)
    if( !email){
        throw new ApiError(400,"username or email is required")
    }

    const user = await User.findOne({
        $or: [{email}]
    })
    if(!user){
        throw new ApiError(404,"User not exist")
    }

    const isPasswordValid  = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedUser = await User.findById(user._id).
    select("-password -refreshToken")

    // For local dev we expose cookies to the client (not httpOnly) and don't require secure.
    // NOTE: This reduces security and should NOT be used in production.
    const options = {
        httpOnly: false,
        secure: false,
    }
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedUser,accessToken,refreshToken
            },
            "user logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true 
        }
    )

    // Match the same cookie options used at login so cookies are cleared correctly.
    const options = {
        httpOnly: false,
        secure: false,
    }

    return res.status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200,{},"User logged out"))

})

const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { username } = req.query;

  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  const existingUser = await User.findOne({
    username: username.toLowerCase(),
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { available: !existingUser },
      existingUser ? "Username already taken" : "Username available"
    )
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, req.user, "User fetched")
  );
});


export {registerUser,loginUser,logoutUser,checkUsernameAvailability,getCurrentUser,}