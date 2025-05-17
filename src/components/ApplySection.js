import "./ApplySection.css";
import React from "react";

function ApplySection({ onApply, onReset, disabled }) {
  return (
    <div className="apply-section-container">
      <h2 className="section-title">Controls</h2>

      <button className="btn apply-btn" onClick={onApply} disabled={disabled}>
        Apply Try-On
      </button>

      <button className="btn reset-btn" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

export default ApplySection;
