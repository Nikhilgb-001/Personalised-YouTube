import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiErrors.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    // get the user from db
    const user = await User.findById(userId);
    // generate accessToken from the method created in the user model
    const accessToken = user.generateAccessToken();
    // generate refreshToken from the method created in the user model
    const refreshToken = user.generateRefreshToken();

    // replace the old refresh token with the new one when user logs in again
    user.refreshToken = refreshToken;
    // save the new refresh token to the database
    await user.save({ validateBeforeSave: false });

    // return the access and refresh tokens
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating access and refresh tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  const { username, fullName, email, password } = req.body;

  // validation - not empty
  if (
    [username, fullName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError("All fields are required");
  }

  // check if user already exists: username, email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  // check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  // console.table(req.files);
  console.log(req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  // return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get user details from frontend username or email
  const { username, email, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  // find user in db
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // check for given password with the password from db using the isPasswordCorrect method created in the user model
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // if the password is correct, generate access token and refresh token using the method created above
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    // pass the generated access token and refresh token to the user
    user._id
  );
  // send cookies to return the loggedIn user info leaving the password and refreshToken
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // return response with options
  const options = {
    httpOnly: true,
    secure: true,
  };

  return (
    res
      .status(200)
      // set the accessToken and refreshToken in the cookies
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            user: loggedInUser,
            accessToken,
            refreshToken,
          },
          "User logged In successfully"
        )
      )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  // remove the refreshToken from the database by finding the loggedIn user using mongoDb's findByIdAndUpdate method
  await User.findByIdAndUpdate(
    // we will get the loggedIn User from the req.user object and we are taking the id from the req.user object and performing the update operation
    req.user.id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  // remove the accessToken and refreshToken from the cookies with options and return the response
  return (
    res
      .status(200)
      // also remove the accessToken and refreshToken from the cookies
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged Out"))
  );
});

export { registerUser, loginUser, logoutUser };
