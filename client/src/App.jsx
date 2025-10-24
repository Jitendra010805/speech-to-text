import { useState, useEffect, useRef } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.js";
import { useNavigate } from "react-router-dom";
import "./App.css";

// Use backend URL from .env
const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [file, setFile] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordTime, setRecordTime] = useState(0);

  const waveformRef = useRef(null);
  const recordPluginRef = useRef(null);
  const waveSurferRef = useRef(null);
  const timerRef = useRef(null);

  const pulseCanvasRef = useRef(null);
  const vuCanvasRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  const navigate = useNavigate();

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startPulse = async () => {
    if (!navigator.mediaDevices.getUserMedia) return;

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    const bufferLength = analyserRef.current.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);
    sourceRef.current.connect(analyserRef.current);

    const pulseCanvas = pulseCanvasRef.current;
    const pulseCtx = pulseCanvas.getContext("2d");
    const centerX = pulseCanvas.width / 2;
    const centerY = pulseCanvas.height / 2;

    const vuCanvas = vuCanvasRef.current;
    const vuCtx = vuCanvas.getContext("2d");

    const bgBlobs = document.querySelector(".bg-blobs");

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;

      // Pulse canvas
      pulseCtx.clearRect(0, 0, pulseCanvas.width, pulseCanvas.height);
      const radius = 20 + (avg / 255) * 50;
      const gradient = pulseCtx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
      gradient.addColorStop(0, "rgba(81,208,222,0.6)");
      gradient.addColorStop(1, "rgba(191,74,168,0)");
      pulseCtx.beginPath();
      pulseCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      pulseCtx.fillStyle = gradient;
      pulseCtx.fill();

      pulseCtx.beginPath();
      pulseCtx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
      pulseCtx.fillStyle = "#bf4aa8";
      pulseCtx.shadowColor = "rgba(191,74,168,0.8)";
      pulseCtx.shadowBlur = 20 * (avg / 255);
      pulseCtx.fill();
      pulseCtx.shadowBlur = 0;

      // VU meter
      const vuWidth = (avg / 255) * vuCanvas.width;
      vuCtx.clearRect(0, 0, vuCanvas.width, vuCanvas.height);
      vuCtx.fillStyle = "#51d0de";
      vuCtx.fillRect(0, 0, vuWidth, vuCanvas.height);

      // Animate background blobs color & scale
      if (bgBlobs) {
        const hueShift = (avg / 255) * 60;
        bgBlobs.style.background = `radial-gradient(circle at top left, hsl(${180 + hueShift}, 65%, 45%), hsl(${220 + hueShift}, 80%, 15%) 60%, #030712)`;
        const scale = 1 + (avg / 255) * 0.03;
        bgBlobs.style.transform = `scale(${scale})`;
      }
    };
    draw();
  };

  const stopPulse = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  useEffect(() => {
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#d9d9d9",
      progressColor: "#51d0de",
      cursorColor: "#bf4aa8",
      height: 80,
      responsive: true,
    });

    const record = ws.registerPlugin(RecordPlugin.create());
    recordPluginRef.current = record;
    waveSurferRef.current = ws;

    record.on("record-end", (blob) => {
      setRecordedBlob(blob);
      setRecording(false);
      setPaused(false);
      clearInterval(timerRef.current);
      setRecordTime(0);
      stopPulse();
    });

    return () => {
      ws.destroy();
      clearInterval(timerRef.current);
      stopPulse();
    };
  }, []);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async (audioBlob = null) => {
    const audioFile = audioBlob
      ? new File([audioBlob], "recorded_audio.wav", { type: "audio/wav" })
      : file;
    if (!audioFile) return alert("Please record or upload an audio file first.");

    const formData = new FormData();
    formData.append("audio", audioFile);
    setLoading(true);
    setTranscription(null);

    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTranscription(res.data.transcription || "No transcription received.");
      setFile(null);
    } catch (err) {
      console.error(err);
      setTranscription("❌ Error uploading or transcribing the file.");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!recordPluginRef.current) return;
    setRecording(true);
    setPaused(false);
    setRecordedBlob(null);
    setRecordTime(0);
    await recordPluginRef.current.startRecording();
    startPulse();
    timerRef.current = setInterval(() => setRecordTime((prev) => prev + 1), 1000);
  };

  const togglePause = async () => {
    if (!recordPluginRef.current) return;
    const record = recordPluginRef.current;
    if (paused) {
      await record.resumeRecording();
      setPaused(false);
      timerRef.current = setInterval(() => setRecordTime((prev) => prev + 1), 1000);
    } else {
      await record.pauseRecording();
      setPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const stopRecording = async () => {
    if (!recordPluginRef.current) return;
    await recordPluginRef.current.stopRecording();
    clearInterval(timerRef.current);
    stopPulse();
  };

  const handlePlayRecording = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    audio.play();
  };

  const handleUploadRecording = () => {
    if (!recordedBlob) return alert("Please record something first!");
    handleUpload(recordedBlob);
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordTime(0);
    setRecording(false);
    setPaused(false);
    setFile(null);
    setTranscription(null);
    if (waveSurferRef.current) waveSurferRef.current.empty();
  };

  return (
    <div className="app-container">
      <div className="bg-blobs"></div>

      <header className="mb-10 text-center">
        <h1 className="mb-3 text-5xl font-extrabold app-title">🎤 Smart Speech-to-Text</h1>
        <p className="text-lg text-gray-200">
          Record, pause/resume, or upload audio — get instant transcriptions powered by Deepgram.
        </p>
      </header>

      <div className="record-upload-section">
        {/* Upload Audio first */}
        <div className="upload-box glass-box rounded-2xl">
          <h2 className="text-xl font-semibold text-center text-purple-300">📁 Upload Audio</h2>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="w-full p-2 text-center text-white border rounded-md bg-white/10"
          />
          <div className="btn-group">
            <button onClick={() => handleUpload()} disabled={loading} className="w-full btn-neon disabled:opacity-50">
              {loading ? "⏳ Processing..." : "⬆️ Upload & Transcribe"}
            </button>
          </div>
        </div>

        {/* Record Audio */}
        <div className="record-box glass-box rounded-2xl">
          <h2 className="text-xl font-semibold text-center text-purple-300">🎙️ Record Audio</h2>

          <canvas id="pulseCanvas" ref={pulseCanvasRef} className="rounded-full shadow-lg" />
          <div ref={waveformRef} id="waveformCanvas"></div>
          <canvas id="vuCanvas" ref={vuCanvasRef} className="rounded-md shadow-inner" />

          {recording && <div className="font-mono text-lg text-center text-blue-300">⏱️ {formatTime(recordTime)}</div>}

          <div className="btn-group">
            {!recording && !recordedBlob ? (
              <button onClick={startRecording} className="btn-neon">⏺️ Start</button>
            ) : (
              <>
                <button onClick={togglePause} className="btn-neon">{paused ? "▶️ Resume" : "⏸️ Pause"}</button>
                <button onClick={stopRecording} className="bg-red-500 btn-neon">⏹️ Stop</button>
              </>
            )}

            {recordedBlob && (
              <>
                <button onClick={handlePlayRecording} className="bg-indigo-500 btn-neon">▶️ Play</button>
                <button onClick={handleUploadRecording} disabled={loading} className="bg-blue-600 btn-neon disabled:opacity-50">
                  {loading ? "⏳ Uploading..." : "⬆️ Upload & Transcribe"}
                </button>
                <button onClick={resetRecording} className="bg-gray-500 btn-neon">🔄 New</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* History button at bottom */}
      <button onClick={() => navigate("/history")} className="history-button">📜 View History</button>

      {/* Transcription Box */}
      {transcription && (
        <div className="transcription-box glass-box rounded-xl">
          <h2 className="mb-2 text-2xl font-semibold text-center text-purple-300">🧠 Transcription Result:</h2>
          <p className="text-lg leading-relaxed text-center text-gray-100 whitespace-pre-wrap">{transcription}</p>
        </div>
      )}
    </div>
  );
}

export default App;
