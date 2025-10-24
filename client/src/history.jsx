import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [message, setMessage] = useState("");
  const audioRefs = useRef({});

  // ✅ Works for both local and production environments
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/history`);
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
      setMessage("❌ Failed to fetch history.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const togglePlay = (id) => {
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
      audio.onended = () => setPlayingId(null);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setMessage("✅ Transcription copied!");
    setTimeout(() => setMessage(""), 3000);
  };

  const deleteHistory = async (id) => {
    try {
      await axios.delete(`${BASE_URL}/api/history/${id}`);
      setHistory((prev) => prev.filter((item) => item._id !== id));
      setMessage("✅ Deleted successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting:", err);
      setMessage("❌ Failed to delete. Try again.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-gray-900 bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-md">
        <h1 className="text-xl font-bold">Transcription History</h1>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600"
        >
          ← Back
        </button>
      </header>

      {/* Notification message */}
      {message && (
        <div
          className={`mx-auto my-4 px-4 py-2 w-fit rounded text-white font-medium ${
            message.includes("✅") ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-6">
        {history.length === 0 ? (
          <div className="mt-20 text-center text-gray-500">
            No transcriptions found.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {history.map((item) => {
              const fileName = item.filePath?.split(/[\\/]/).pop() || "Unknown File";
              const uploadedDate = new Date(item.createdAt).toLocaleString();
              const isPlaying = playingId === item._id;

              // ✅ Ensure file works for both localhost and hosted URLs
              const audioSrc = item.filePath?.startsWith("uploads")
                ? `${BASE_URL}/${item.filePath}`
                : item.filePath;

              return (
                <div
                  key={item._id}
                  className="p-4 bg-white border border-gray-200 rounded-lg shadow-md"
                >
                  <h2 className="mb-2 font-semibold text-gray-800">{fileName}</h2>

                  <audio
                    ref={(el) => (audioRefs.current[item._id] = el)}
                    src={audioSrc}
                  />

                  <div className="flex items-center gap-2 my-3">
                    <button
                      onClick={() => togglePlay(item._id)}
                      className="px-3 py-1 text-white bg-blue-500 rounded hover:bg-blue-600"
                    >
                      {isPlaying ? "Pause" : "Play"}
                    </button>

                    <button
                      onClick={() => copyText(item.text)}
                      className="px-3 py-1 text-gray-800 bg-gray-300 rounded hover:bg-gray-400"
                    >
                      Copy
                    </button>

                    <button
                      onClick={() => deleteHistory(item._id)}
                      className="px-3 py-1 text-white bg-red-500 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>

                  <p className="mb-2 text-sm text-gray-700">
                    {item.text || "No transcription available."}
                  </p>

                  <p className="text-xs text-gray-500">{uploadedDate}</p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-sm text-center text-gray-500 bg-white border-t">
        © 2025 Smart Speech-to-Text
      </footer>
    </div>
  );
}
