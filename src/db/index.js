import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";



const connectDB = async ()=>{
    
    try{
        const connectionInstace = await mongoose.connect(
          `${process.env.MONGODB_URL}/${DB_NAME}`
        );
        console.log(`MongoDB connected DB_HOST : ${connectionInstace.connection.host}`);

    }catch(error){
        console.error("MongoDB connection error",error.message)
        process.exit(1)
    }
}

export default connectDB
