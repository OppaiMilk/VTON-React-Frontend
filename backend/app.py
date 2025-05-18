from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import base64
from io import BytesIO

import model_inference  # Your custom module

app = Flask(__name__)
CORS(app)

@app.route("/infer", methods=["POST"])
def infer():
    data = request.get_json()
    base64_image = data.get("image")

    if not base64_image:
        return jsonify({"error": "No image data provided"}), 400

    try:
        base64_data = base64_image.split(",")[-1]
        image_data = base64.b64decode(base64_data)
        image = Image.open(BytesIO(image_data)).convert("RGB")

        seg_pred, lm_pred, segmented_image = model_inference.predict(image)

        # Note: This function already returns "data:image/png;base64,..."
        segmented_url = model_inference.save_segmented_pil(segmented_image)

        return jsonify({
            "segmentation": seg_pred.tolist(),        # convert ndarray to list
            "landmarks": lm_pred.tolist(),            # convert ndarray to list
            "segmentedImage": segmented_url           # already base64-encoded string
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)