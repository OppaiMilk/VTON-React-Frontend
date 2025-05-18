import React, { useState, useRef, useEffect } from "react";
import "./UploadClothes.css";

function UploadClothes({ onUpload, uploadedClothes ,onReset}) {
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef();

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result);
        onUpload(file);    
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (uploadedClothes === null) {
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
    }
  }, [uploadedClothes]);

  return (
    <div className="container">
      <h3>Clothing Upload</h3>

      <div className="image-container">
        {preview ? (
          <img
            src={preview}
            alt="Uploaded Preview"
            className="preview-image"
          />
        ) : (
          <p>No Image Selected</p>
        )}
      </div>

      <div className="upload-container">
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          ref={fileInputRef}
        />
      </div>

      <button className="btn reset-btn" style={{marginTop:"10px"}} onClick={onReset}>
        Reset
      </button>
      
    </div>
  );
}

export default UploadClothes;
