import { useState, useEffect } from "react";
import axios from "axios";

export default function UploadAudio() {
  const [file, setFile] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [history, setHistory] = useState([]);

  // Fetch history on component mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/history");
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Select an audio file first");
    const formData = new FormData();
    formData.append("audio", file);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setTranscription(res.data.transcription);
      fetchHistory(); // Refresh history
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xl font-bold">Upload Audio</h2>
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button
        className="px-4 py-2 ml-2 text-white bg-blue-500 rounded"
        onClick={handleUpload}
      >
        Upload
      </button>

      {transcription && (
        <div className="mt-4">
          <h3 className="font-semibold">Transcription:</h3>
          <p>{transcription}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-semibold">History:</h3>
          <ul>
            {history.map((item) => (
              <li key={item._id} className="pb-2 mb-2 border-b">
                <p><strong>Text:</strong> {item.text}</p>
                <p><strong>File:</strong> {item.filePath}</p>
                <p><strong>Uploaded at:</strong> {new Date(item.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
