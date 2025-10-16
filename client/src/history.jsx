import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaFileAudio, FaFileAlt, FaCopy, FaPlay, FaPause } from "react-icons/fa";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const audioRefs = useRef({}); // store audio elements by id

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/history");
      setHistory(res.data.reverse());
    } catch (err) {
      console.error(err);
    }
  };

  const togglePlay = (id) => {
    // pause any other playing audio
    Object.keys(audioRefs.current).forEach((key) => {
      if (key !== id && audioRefs.current[key]) audioRefs.current[key].pause();
    });

    const audio = audioRefs.current[id];
    if (!audio) return;

    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.play();
      setPlayingId(id);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    alert("Transcription copied!");
  };

  const getFileTypeIcon = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["mp3", "wav", "m4a"].includes(ext))
      return <FaFileAudio className="w-6 h-6 mr-2 text-blue-500" />;
    return <FaFileAlt className="w-6 h-6 mr-2 text-gray-500" />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#51d0de] via-[#bf4aa8] to-[#d9d9d9]">
      <header className="py-4 text-center bg-white shadow-md">
        <h1 className="text-3xl font-bold text-[#1e40af]">📜 Transcription History</h1>
      </header>

      <main className="flex flex-col items-center flex-1 p-6 overflow-y-auto">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {history.length === 0 ? (
            <p className="text-center text-gray-700 col-span-full">
              No previous transcriptions.
            </p>
          ) : (
            history.map((item) => {
              const fileName = item.filePath.split("\\").pop();
              const uploadedDate = new Date(item.createdAt);
              const isRecent =
                (Date.now() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24) < 1;

              return (
                <div
                  key={item._id}
                  className="flex flex-col justify-between p-6 bg-white rounded-2xl border-l-4 border-[#51d0de]
                             shadow-lg hover:shadow-2xl hover:scale-105 transform transition-all duration-300
                             min-h-[340px] h-auto"
                >
                  {/* Text content */}
                  <div className="mb-6">
                    <div className="flex items-start mb-3">
                      {getFileTypeIcon(fileName)}
                      <h2 className="text-lg font-semibold text-gray-800 line-clamp-3">
                        {item.text}
                      </h2>
                    </div>
                    <p className="mb-3 text-sm text-gray-500">File: {fileName}</p>
                    <span
                      className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                        isRecent ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {uploadedDate.toLocaleString()}
                    </span>
                  </div>

                  {/* Buttons container with proper vertical spacing */}
                  {["mp3", "wav", "m4a"].includes(fileName.split(".").pop().toLowerCase()) && (
                    <div className="flex flex-col gap-4 mt-6"> {/* gap-4 ensures spacing */}
                      {/* Hidden audio element */}
                      <audio
                        ref={(el) => (audioRefs.current[item._id] = el)}
                        src={`http://localhost:5000/${item.filePath}`}
                      />

                      {/* Play/Pause Button */}
                      <button
                        onClick={() => togglePlay(item._id)}
                        className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white
                                   rounded-lg transition-all duration-300 transform
                                   ${
                                     playingId === item._id
                                       ? "bg-blue-600 shadow-[0_0_20px_rgba(81,208,222,0.7)] animate-pulse"
                                       : "bg-blue-600 hover:bg-blue-700"
                                   }`}
                      >
                        {playingId === item._id ? (
                          <>
                            <FaPause className="mr-2" /> Pause Audio
                          </>
                        ) : (
                          <>
                            <FaPlay className="mr-2" /> Play Audio
                          </>
                        )}
                      </button>

                      {/* Copy Transcription Button */}
                      <button
                        onClick={() => copyText(item.text)}
                        className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-all duration-300 transform bg-green-600 rounded-lg hover:bg-green-700 hover:scale-105"
                      >
                        <FaCopy className="mr-2" /> Copy Transcription
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Back button */}
        <div className="flex justify-center w-full max-w-4xl mt-12">
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 text-white transition-all duration-300 transform bg-blue-600 rounded-xl hover:bg-blue-700 hover:scale-105"
          >
            ⬅ Back
          </button>
        </div>
      </main>

      <footer className="py-4 mt-auto text-center bg-white shadow-inner">
        <p className="text-gray-600">© 2025 Smart Speech-to-Text</p>
      </footer>
    </div>
  );
}
