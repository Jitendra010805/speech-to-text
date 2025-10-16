const path = require("path");
const dotenv = require("dotenv");

// Explicitly load .env
const result = dotenv.config({ path: path.resolve(__dirname, ".env") });
if (result.error) {
  console.error("❌ Failed to load .env:", result.error);
  process.exit(1);
}
console.log("✅ .env loaded successfully");

const mongoose = require('mongoose');

console.log("Attempting to connect to MongoDB...");
console.log("MONGO_URI exists:", process.env.MONGO_URI ? "Yes" : "No");

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });
