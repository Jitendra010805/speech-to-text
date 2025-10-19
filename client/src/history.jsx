import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaPlay, FaPause, FaCopy, FaFileAudio, FaChevronDown, FaChevronUp } from "react-icons/fa";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [waveformData, setWaveformData] = useState({});
  const audioRefs = useRef({});
  const audioContexts = useRef({});
  const animationRefs = useRef({});

  useEffect(() => {
    fetchHistory();
    return () => stopAllWaveforms();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/history");
      setHistory(res.data.reverse());
    } catch (err) {
      console.error(err);
    }
  };

  const stopAllWaveforms = () => {
    Object.values(animationRefs.current).forEach((id) => cancelAnimationFrame(id));
    Object.values(audioContexts.current).forEach((ctx) => ctx.close());
    animationRefs.current = {};
    audioContexts.current = {};
    setWaveformData({});
  };

  const togglePlay = (id) => {
    Object.keys(audioRefs.current).forEach((key) => {
      if (key !== id && audioRefs.current[key]) audioRefs.current[key].pause();
    });
    stopAllWaveforms();

    const audio = audioRefs.current[id];
    if (!audio) return;

    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.play();
      setPlayingId(id);
      startWaveform(id, audio);
    }
  };

  const startWaveform = (id, audio) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      setWaveformData((prev) => ({ ...prev, [id]: Array.from(dataArray) }));
      animationRefs.current[id] = requestAnimationFrame(update);
    };
    update();
    audioContexts.current[id] = ctx;
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Transcription copied!");
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const Waveform = ({ data }) => {
    if (!data) return null;
    const bars = data.slice(0, 20);
    return (
      <div className="flex items-end justify-center h-10 gap-1 mt-3">
        {bars.map((value, i) => (
          <div
            key={i}
            className="w-1.5 bg-gray-300 transition-all duration-100 ease-in-out opacity-80"
            style={{
              height: `${Math.max(4, (value / 255) * 40)}px`,
              transitionDelay: `${i * 0.03}s`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 bg-[#181818] shadow-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#1db954]">
            🎧 Your Transcriptions
          </h1>
          <button
            onClick={() => navigate("/")}
            className="bg-[#1db954] hover:bg-[#1ed760] text-black px-5 py-2 rounded-full font-semibold transition-all"
          >
            ⬅ Back
          </button>
        </div>
      </header>

      <main className="flex-1 p-10">
        {history.length === 0 ? (
          <div className="mt-20 text-lg text-center text-gray-400">
            No previous transcriptions yet.
          </div>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {history.map((item) => {
              const fileName = item.filePath.split("\\").pop();
              const uploadedDate = new Date(item.createdAt).toLocaleString();
              const isExpanded = expandedId === item._id;
              const isPlaying = playingId === item._id;

              return (
                <div
                  key={item._id}
                  className={`group flex flex-col items-center bg-[#1e1e1e] p-6 rounded-xl shadow-lg
                              hover:scale-105 hover:shadow-2xl transition-all duration-300 relative
                              ${isPlaying ? "animate-pulse-glow" : ""}`}
                >
                  {/* Audio Icon */}
                  <div className="relative w-40 h-40 bg-[#282828] rounded-lg flex items-center justify-center overflow-hidden">
                    <FaFileAudio className="text-[#1db954] text-6xl opacity-90" />
                    <button
                      onClick={() => togglePlay(item._id)}
                      className="absolute opacity-0 group-hover:opacity-100 bg-[#1db954] text-black rounded-full w-12 h-12 flex items-center justify-center transition-all transform group-hover:scale-110 shadow-lg"
                    >
                      {isPlaying ? <FaPause /> : <FaPlay />}
                    </button>
                    <audio
                      ref={(el) => (audioRefs.current[item._id] = el)}
                      src={`http://localhost:5000/${item.filePath}`}
                    />
                  </div>

                  {/* Hover waveform preview */}
                  {!isPlaying && (
                    <div className="flex items-end justify-center h-6 gap-1 mt-2 transition-opacity duration-300 opacity-0 group-hover:opacity-80">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-gray-500 rounded-sm"
                          style={{ height: `${Math.floor(Math.random() * 12 + 4)}px` }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Live waveform */}
                  {isPlaying && <Waveform data={waveformData[item._id]} />}

                  {/* Transcription */}
                  <div
                    className="mt-5 text-center cursor-pointer select-none"
                    onClick={() => toggleExpand(item._id)}
                  >
                    <p
                      className={`text-sm text-gray-300 ${
                        isExpanded ? "" : "line-clamp-2"
                      } transition-all duration-300`}
                    >
                      {item.text || "No transcription available."}
                    </p>
                    <div className="flex justify-center items-center gap-1 mt-1 text-[#1db954] text-xs font-medium">
                      {isExpanded ? (
                        <>
                          <FaChevronUp /> Show Less
                        </>
                      ) : (
                        <>
                          <FaChevronDown /> Show More
                        </>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <p className="mt-2 text-xs text-gray-500">{uploadedDate}</p>

                  {/* Copy button */}
                  <button
                    onClick={() => copyText(item.text)}
                    className="mt-4 flex items-center justify-center gap-2 bg-[#1db954] text-black font-medium px-4 py-2 rounded-full hover:bg-[#1ed760] transition-all"
                  >
                    <FaCopy /> Copy
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="py-5 text-center text-gray-500 text-sm bg-[#121212] border-t border-[#1f1f1f]">
        © 2025 Smart Speech-to-Text | Powered by Deepgram
      </footer>

      {/* Glow animation */}
      <style>
        {`
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 10px rgba(29, 185, 84, 0.5); }
            50% { box-shadow: 0 0 25px rgba(29, 185, 84, 0.8); }
          }
          .animate-pulse-glow {
            animation: pulseGlow 1.2s infinite;
          }
        `}
      </style>
    </div>
  );
}
