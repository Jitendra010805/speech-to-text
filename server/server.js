// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ msg: 'Hello from server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // files will be saved in server/uploads

app.post("/api/upload", upload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ msg: "No file uploaded" });
  console.log("Uploaded file:", req.file);
  res.json({ msg: `File ${req.file.originalname} uploaded successfully!` });
});