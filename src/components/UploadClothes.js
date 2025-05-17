import React, { useState, useRef, useEffect } from "react";
import "./UploadClothes.css";

function UploadClothes({ onUpload, uploadedClothes }) {
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef();

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = { name: file.name, url: reader.result };
        setPreview(result.url);
        onUpload(result);
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
    </div>
  );
}

export default UploadClothes;
