import React, { useRef, useState, useEffect } from "react";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";
import "./CameraView.css";
import { TryOnProcessor } from "./try-on";

function CameraView({ uploadedClothes }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const imageProcessor = useRef(new TryOnProcessor());
  const [cameraOn, setCameraOn] = useState(false);
  const [net, setNet] = useState(null);

  useEffect(() => {
    if (!uploadedClothes || !(uploadedClothes instanceof Blob)) {
      console.warn("Invalid uploadedClothes file:", uploadedClothes);
      return;
    }

    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.src = reader.result;

      image.onload = () => {
        // 1. Draw original image to canvas
        const shirtCanvas = document.createElement("canvas");
        shirtCanvas.width = image.width;
        shirtCanvas.height = image.height;

        const ctx = shirtCanvas.getContext("2d");
        ctx.drawImage(image, 0, 0);

        // 2. Convert to base64
        const base64String = shirtCanvas.toDataURL("image/png");

        // 3. Send to Flask backend
        fetch("http://localhost:5000/infer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64String }),
        })
          .then((res) => res.json())
          .then((data) => {
            const shirtLandmark = data.landmarks;
            const segmentedBase64 = data.segmentedImage;

            // Use segmented image in markPointOnShirt
            const segmentedImage = new Image();
            segmentedImage.src = segmentedBase64;

            console.log(shirtLandmark)

            segmentedImage.onload = () => {
              const landmarkData = shirtLandmark;

              const { canvasWithPoints, fourPoints } = imageProcessor.current.markPointOnShirt(
                segmentedImage,
                segmentedImage.width,
                segmentedImage.height,
                landmarkData
              );

              imageProcessor.current.canvasWithPoints = canvasWithPoints;
              imageProcessor.current.fourPoints = fourPoints;

              console.log("Canvas with points created from segmented image.");
            };
          })
          .catch((err) => {
            console.error("Error sending image to Flask backend: ", err);
          });
      };
    };

    reader.readAsDataURL(uploadedClothes);
  }, [uploadedClothes]);

  // Load BodyPix model once
  useEffect(() => {
    const loadModel = async () => {
      const loadedNet = await bodyPix.load({
        architecture: "ResNet50",
        outputStride: 16,
        multiplier: 1,
        quantBytes: 2,
        internalResolution: "high",
      });
      setNet(loadedNet);
    };
    loadModel();
  }, []);

  // Drawing loop
  useEffect(() => {
    let animationFrameId;

    const draw = async () => {
      if (
        net &&
        videoRef.current &&
        canvasRef.current &&
        videoRef.current.readyState === 4
      ) {
        const video = videoRef.current;
        const outputCanvas = canvasRef.current;

        // Create and sync offscreen canvas
        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = video.videoWidth;
        offscreenCanvas.height = video.videoHeight;
        const offscreenCtx = offscreenCanvas.getContext("2d");

        // Step 1: Run segmentation
        const segmentation = await net.segmentPersonParts(videoRef.current, {
          segmentationThreshold: 0.7,
          flipHorizontal: true,
          internalResolution: "high",
          maxDetections: 1,
        });

        // Step 2: Pose processing (if needed for alignment later)
        const { pose, flat } = imageProcessor.current.processKeypoint(segmentation);
        console.log("Flat:", flat);
        
        // Step 3: Draw video on offscreen 
        offscreenCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

        // Step 4: Draw BodyPix mask on if screen
        // const opacity = 0.4;
        // const maskBlurAmount = 1;

        // bodyPix.drawMask(
        //   offscreenCanvas,
        //   video,
        //   bodyPix.toColoredPartMask(segmentation),
        //   opacity,
        //   maskBlurAmount,
        //   false
        // );

        // Step 5: Overlay shirt - will be added later
        if (
          imageProcessor.current.canvasWithPoints &&
          imageProcessor.current.fourPoints &&
          flat
        ) {
          const shirtOverlay = imageProcessor.current.applyPerspectiveTransform(
            imageProcessor.current.canvasWithPoints,
            imageProcessor.current.fourPoints, // source points on the shirt
            flat,                              // destination points on the body
            offscreenCanvas.width,
            offscreenCanvas.height
          );

          offscreenCtx.drawImage(shirtOverlay, 0, 0);
        }

        // For debugging
        // if (imageProcessor.current.shirtCanvas) {
        //   // Just draw the shirtCanvas at top-left corner
        //   offscreenCtx.drawImage(imageProcessor.current.shirtCanvas, 10, 10);

        //   // Optional: draw a border around it
        //   offscreenCtx.strokeStyle = "red";
        //   offscreenCtx.lineWidth = 2;
        //   offscreenCtx.strokeRect(
        //     10,
        //     10,
        //     imageProcessor.current.shirtCanvas.width,
        //     imageProcessor.current.shirtCanvas.height
        //   );
        // }

        // Show offscreen
        const outputCtx = outputCanvas.getContext("2d");
        outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        outputCtx.drawImage(offscreenCanvas, 0, 0);
      }

    animationFrameId = requestAnimationFrame(draw);
  };

    if (cameraOn) {
      draw();
    } else {
      cancelAnimationFrame(animationFrameId);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [cameraOn, net]);

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { exact: 640 },
          height: { exact: 480 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      streamRef.current = stream;
      setCameraOn(true);

      console.log("uploadedClothes inside CameraView:", uploadedClothes);

    } catch (error) {
      console.error("Failed to start camera:", error);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
      <h1 className="section-title">Live Preview with BodyPix</h1>

       {/* Canvas used to display video + segmentation */}
      <canvas
        ref={canvasRef}
        className="canvas-overlay"
        width="640"
        height="480"
      />

      {/* Hidden video used only for reading frames */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width="640"
        height="480"
        style={{ display: "none" }}
      />

      <div className="control-section">
        <button className="btn" onClick={startCamera} disabled={cameraOn}>
          Start Camera
        </button>
        <button className="btn" onClick={stopCamera} disabled={!cameraOn}>
          Stop Camera
        </button>
      </div>
    </div>
  );
}

export default CameraView;
