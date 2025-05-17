import React, { useRef, useState } from "react";
import "./CameraView.css";

function CameraView() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch (error) {
      console.error("Failed to start camera:", error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  };

  return (
    <div className="video_container">
      <h1 className="section-title">Live Preview</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video"
      />

      <div className="control-section" >
        <button
          className="btn"
          onClick={startCamera}
          disabled={cameraOn}
        >
          Start Camera
        </button>
        <button
          className="btn"
          onClick={stopCamera}
          disabled={!cameraOn}
        >
          Stop Camera
        </button>
      </div>
    </div>
  );
}

export default CameraView;
