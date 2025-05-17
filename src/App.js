import React, { useState, useEffect } from "react";
import CameraView from "./components/CameraView";
import UploadClothes from "./components/UploadClothes";
import ApplySection from './components/ApplySection';

function App() {
  const [cvReady, setCvReady] = useState(false);
  const [uploadedClothes, setUploadedClothes] = useState(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Wait for OpenCV to finish loading
    const checkOpenCV = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        window.cv.onRuntimeInitialized = () => {
          console.log("OpenCV.js is ready");
          setCvReady(true);
        };
        clearInterval(checkOpenCV);
      }
    }, 100);
  }, []);

  useEffect(() => {
    document.body.className = isDark ? "dark-theme" : "";
  }, [isDark]);

  const canTryOn = uploadedClothes !== null;

  const handleTryOn = () => {
    console.log('Try-On started!');
    
  };

  
  const handleReset = () => {
    setUploadedClothes(null); 
  };

  return (
    <div
      className="bg-primary"
      style={{ paddingLeft: "10vw", paddingRight: "10vw" }}
    >
      <div
        className="bg-primary row-justify-between"
        style={{ paddingBottom: "0px" }}
      >
        <h1>Virtual Clothing Try-On</h1>
        <label className="switch">
          <input
            type="checkbox"
            checked={isDark}
            onChange={() => setIsDark(!isDark)}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="bg-primary row" style={{ paddingTop: "0px" }}>
        <div className="bg-primary column">
          <UploadClothes onUpload={setUploadedClothes} uploadedClothes={uploadedClothes} />
          <ApplySection
            onApply={handleTryOn}
            onReset={handleReset}
            disabled={!canTryOn}
          />
        </div>

        <div className="Video">
          <CameraView uploadedClothes={uploadedClothes} />
        </div>
      </div>
    </div>
  );
}

export default App;
