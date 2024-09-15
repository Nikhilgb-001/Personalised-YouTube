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

export { app };
