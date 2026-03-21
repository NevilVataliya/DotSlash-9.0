
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
// // route declaration

app.use("/api/v1/users", userRouter)
app.use("/api/v1/trips", tripRouter)
app.use("/api/v1/vehicles", vehicleRouter)
app.use("/api/v1/pools", poolRouter)
app.use("/api/v1/parcels", parcelRouter)

//localhost:8000/api/v1/users/register or anything in the urserRouter 
app.get('/', (req, res) => {
    res.json('SErver is ready');
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
    console.log(`Server at http://localhost:${port}`);
});