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
        const shirtCanvas = document.createElement("canvas");
        shirtCanvas.width = image.width;
        shirtCanvas.height = image.height;

        const landmarkData = {
          "landmarks": [
            225, 200, 163, 187, 186, 227, 232, 242, 268, 223,
            285, 183, 84, 240, 65, 270, 45, 304, 110, 372,
            118, 345, 116, 316, 119, 326, 119, 404, 121, 507,
            242, 508, 344, 505, 345, 394, 344, 320, 341, 299,
            344, 335, 353, 370, 414, 299, 394, 264, 365, 226
          ]
        };

        const { canvasWithPoints, fourPoints } = imageProcessor.current.markPointOnShirt(shirtCanvas, shirtCanvas.width, shirtCanvas.height, landmarkData);

        console.log(`Shirt Canvas Dimension = ${ shirtCanvas.width} x ${ shirtCanvas.height }`);
        console.log("Cavas point: ", canvasWithPoints);
        console.log("Four point: ", fourPoints);

        const ctx = shirtCanvas.getContext("2d");
        ctx.drawImage(image, 0, 0);

        imageProcessor.current.shirtCanvas = shirtCanvas;
        imageProcessor.current.canvasWithPoints = canvasWithPoints;
        imageProcessor.current.fourPoints = fourPoints;

        console.log("Clothing image loaded and drawn to shirtCanvas.");
      };
    };

    reader.readAsDataURL(uploadedClothes);
  }, [uploadedClothes]);

  // Load BodyPix model once
  useEffect(() => {
    const loadModel = async () => {
      const loadedNet = await bodyPix.load({
        architecture: "MobileNetV1",
        outputStride: 16,
        multiplier: 1,
        quantBytes: 2,
        internalResolution: "low",
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
          internalResolution: "medium",
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
          imageProcessor.current.shirtCanvas &&
          imageProcessor.current.fourPoints &&
          flat
        ) {
          const shirtOverlay = imageProcessor.current.applyPerspectiveTransform(
            imageProcessor.current.shirtCanvas,
            imageProcessor.current.fourPoints, // source points on the shirt
            flat,                              // destination points on the body
            offscreenCanvas.width,
            offscreenCanvas.height
          );

          offscreenCtx.drawImage(shirtOverlay, 0, 0);
        }

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
