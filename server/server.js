const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@deepgram/sdk");

dotenv.config();

// --------------------
// Check Environment Variables
// --------------------
if (!process.env.DEEPGRAM_API_KEY) {
  console.error("❌ DEEPGRAM_API_KEY missing in .env");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

console.log("✅ .env loaded successfully");
console.log("Deepgram key present:", !!process.env.DEEPGRAM_API_KEY);

// --------------------
// Initialize App & Middleware
// --------------------
const app = express();
app.use(cors()); // Enable CORS
app.use(express.json());

// --------------------
// Deepgram Client
// --------------------
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// --------------------
// MongoDB Model
// --------------------
const Transcription = require("./models/Transcription");
const { Z_BEST_COMPRESSION } = require("zlib");

// --------------------
// Ensure Upload Folder Exists
// --------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// --------------------
// Multer Setup
// --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// --------------------
// 📤 Upload & Transcribe Route
// --------------------
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

  // Save transcription to MongoDB
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

// --------------------
// 📜 Fetch History Route
// --------------------
app.get("/api/history", async (req, res) => {
  try {
    const all = await Transcription.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching history" });
  }
});

// --------------------
// 🗑️ Delete History Route
// --------------------
app.delete("/api/history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🧩 DELETE REQUEST RECEIVED, ID:", id);

    const transcription = await Transcription.findById(id);
    if (!transcription) {
      console.warn("⚠️ Transcription not found for ID:", id);
      return res.status(404).json({ error: "Transcription not found" });
    }

    // Resolve full file path
    const filePath = path.resolve(path.join(__dirname, transcription.filePath));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("✅ Deleted file:", filePath);
    } else {
      console.warn("⚠️ File not found:", filePath);
    }

    // Delete DB record
    await Transcription.findByIdAndDelete(id);
    console.log("🗑️ Deleted transcription:", id);

    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// --------------------
// Serve Uploaded Files
// --------------------
app.use("/uploads", express.static(uploadDir));

// --------------------
// Serve React Frontend
// --------------------
const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

// --------------------
// Connect MongoDB & Start Server
// --------------------
const dns = require("dns").promises;

async function resolveMongoSrv(uri) {
  if (!uri.startsWith("mongodb+srv://")) {
    return uri;
  }

  const attemptResolve = async (dnsServers) => {
    if (dnsServers) {
      dns.setServers(dnsServers);
    }

    const match = uri.match(/^mongodb\+srv:\/\/([^/]+)(.*)$/);
    if (!match) return uri;

    const authorityAndHost = match[1];
    const pathAndOptions = match[2];

    let credentials = "";
    let host = authorityAndHost;

    if (authorityAndHost.includes("@")) {
      const parts = authorityAndHost.split("@");
      host = parts.pop();
      credentials = parts.join("@") + "@";
    }

    const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${host}`);
    if (!srvRecords || srvRecords.length === 0) {
      throw new Error("No SRV records found");
    }

    const hostsList = srvRecords
      .map((record) => `${record.name}:${record.port}`)
      .join(",");

    let txtOptions = "";
    try {
      const txtRecords = await dns.resolveTxt(host);
      if (txtRecords && txtRecords.length > 0) {
        txtOptions = txtRecords.flat().join("&");
      }
    } catch (txtErr) {
      // Ignored: TXT records are optional
    }

    let database = "";
    let queryParams = "";
    const pathMatch = pathAndOptions.match(/^\/([^?]*)(?:\?(.*))?$/);
    if (pathMatch) {
      database = pathMatch[1] || "";
      queryParams = pathMatch[2] || "";
    }

    const allOptions = [];
    if (txtOptions) allOptions.push(txtOptions);
    if (queryParams) allOptions.push(queryParams);
    if (!allOptions.some((opt) => opt.includes("ssl=") || opt.includes("tls="))) {
      allOptions.push("ssl=true");
    }

    const finalQuery = allOptions.length > 0 ? `?${allOptions.join("&")}` : "";
    return `mongodb://${credentials}${hostsList}/${database}${finalQuery}`;
  };

  try {
    // Try resolving with default DNS configuration
    return await attemptResolve();
  } catch (err) {
    console.warn(`⚠️ DNS SRV resolution failed with default DNS: ${err.message}. Retrying with public DNS (8.8.8.8, 1.1.1.1)...`);
    try {
      // Retry with Google and Cloudflare public DNS
      return await attemptResolve(["8.8.8.8", "1.1.1.1"]);
    } catch (retryErr) {
      console.error(`❌ DNS SRV resolution failed with public DNS: ${retryErr.message}`);
      return uri; // Return original URI as last resort
    }
  }
}

async function connectMongo() {
  const originalUri = process.env.MONGO_URI;
  let connectionUri = originalUri;

  try {
    connectionUri = await resolveMongoSrv(originalUri);
  } catch (err) {
    console.error("⚠️ Error while resolving MONGO_URI:", err.message);
  }

  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect(connectionUri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("🔄 Retrying MongoDB connection in 10 seconds...");
    setTimeout(connectMongo, 10000);
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  connectMongo();
});

