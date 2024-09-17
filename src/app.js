import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// accepting front form data
app.use(express.json({ limit: "16kb" }));
// accepting url data and encoding them
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
// serving static files
app.use(express.static("public"));
// accepting cookies and manipulate them
app.use(cookieParser());

// routes import
import userRouter from "./routes/user.routes.js";

// routes declaration
app.use("/api/v1/users", userRouter);
// url creates as http://localhost:8000/api/v1/users/register

export { app };
