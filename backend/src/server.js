
import express from "express";
import connectDB from "./db/index.js";
import cors from "cors";
import dotenv from "dotenv";

import cookieParser from "cookie-parser";
import dns from "dns"
// const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

connectDB();


const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cookieParser())

import userRouter from './routes/user.js'
import tripRouter from './routes/trip.js'
import vehicleRouter from './routes/vehicle.js'
import poolRouter from './routes/pool.js'
import parcelRouter from './routes/parcel.js'
import creditRouter from './routes/credit.js'
// // route declaration

app.use("/api/v1/users", userRouter)
app.use("/api/v1/trips", tripRouter)
app.use("/api/v1/vehicles", vehicleRouter)
app.use("/api/v1/pools", poolRouter)
app.use("/api/v1/parcels", parcelRouter)
app.use("/api/v1/credits", creditRouter)

// /api/v1/users/register or anything in the userRouter
app.get('/', (req, res) => {
    res.json('SErver is ready');
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

app.use((err, req, res, next) => {
    const statusCode = err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";

    console.error("API Error:", err);

    res.status(statusCode).json({
        success: false,
        message,
        errors: err?.errors || [],
    });
});

const port = process.env.PORT || 5000;

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: err.success || false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
    });
});
const host = process.env.HOST || '0.0.0.0';
const publicUrl = process.env.SERVER_PUBLIC_URL || `http://${host}:${port}`;

app.listen(port, host, () => {
    console.log(`Server at ${publicUrl}`);
});