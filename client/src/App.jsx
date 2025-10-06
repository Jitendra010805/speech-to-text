import { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [response, setResponse] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file!");
    const formData = new FormData();
    formData.append("audio", file);

    const res = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setResponse(data.msg);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <input type="file" accept="audio/*" onChange={handleFileChange} />
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleUpload}
      >
        Upload Audio
      </button>
      {response && <p className="mt-4">{response}</p>}
    </div>
  );
}

export default App;
