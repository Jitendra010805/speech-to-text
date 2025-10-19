const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@deepgram/sdk");

dotenv.config();

// Check Deepgram API Key
if (!process.env.DEEPGRAM_API_KEY) {
  console.error("❌ DEEPGRAM_API_KEY missing in .env");
  process.exit(1);
}

console.log("✅ .env loaded successfully");
console.log("Deepgram key present:", !!process.env.DEEPGRAM_API_KEY);

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// MongoDB model
const Transcription = require("./models/Transcription");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// --------------------
// API Routes
// --------------------

// Upload & transcribe audio
app.post("/api/upload", upload.single("audio"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ transcription: "No file uploaded" });

  console.log("📁 Uploaded file:", req.file.path);
  let transcriptionText = "";

  try {
    const audioStream = fs.createReadStream(req.file.path);
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioStream,
      {
        model: "nova-3",
        smart_format: true,
      }
    );

    transcriptionText =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
      "No speech detected in audio.";
    console.log("✅ Deepgram transcription success:", transcriptionText);
  } catch (err) {
    console.error("❌ Deepgram transcription failed:", err.message);
    transcriptionText = "Unable to transcribe this audio.";
  }

  // Save to MongoDB
  try {
    const relativePath = path.join("uploads", path.basename(req.file.path));
    await Transcription.create({
      filePath: relativePath,
      text: transcriptionText,
    });
    console.log("💾 Saved transcription to DB:", relativePath);
  } catch (err) {
    console.error("❌ MongoDB save error:", err.message);
  }

  res.json({ transcription: transcriptionText });
});

// Fetch transcription history
app.get("/api/history", async (req, res) => {
  try {
    const all = await Transcription.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching history" });
  }
});

// Serve uploaded files
app.use("/uploads", express.static(uploadDir));

// --------------------
// Serve React Frontend
// --------------------

// Serve React build
const clientBuildPath = path.join(__dirname, "../client/build");
app.use(express.static(clientBuildPath));

// For all other routes, send index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});


// --------------------
// Connect MongoDB & start server
// --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB error:", err.message));
