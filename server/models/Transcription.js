// backend/models/Transcription.js
const mongoose = require("mongoose");

const TranscriptionSchema = new mongoose.Schema({
  filePath: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
},
  { timestamps: true }
);

module.exports = mongoose.model("Transcription", TranscriptionSchema);
