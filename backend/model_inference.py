import tensorflow as tf
import numpy as np
import cv2
import matplotlib.pyplot as plt
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from PIL import Image
import base64
from io import BytesIO

# Constants
IMAGE_SIZE = (256, 256)
NUM_LANDMARKS = 25
NUM_SEGMENTATION_CHANNELS = 3

def build_finetuning_model(input_shape=(256, 256, 3)):
    base_model = MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet',
        pooling=None
    )

    for layer in base_model.layers[:100]:
        layer.trainable = False

    input_image = base_model.input

    block_features = []
    for i, layer in enumerate(base_model.layers):
        if isinstance(layer, tf.keras.layers.Conv2D) and layer.strides == (2, 2):
            if i > 3:
                block_features.append(base_model.layers[i-1].output)

    x = base_model.output

    x = layers.Conv2DTranspose(256, (4, 4), strides=2, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    if len(block_features) > 0:
        x = layers.Concatenate()([x, block_features[-1]])

    x = layers.Conv2DTranspose(128, (4, 4), strides=2, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    if len(block_features) > 1:
        x = layers.Concatenate()([x, block_features[-2]])

    x = layers.Conv2DTranspose(64, (4, 4), strides=2, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    if len(block_features) > 2:
        x = layers.Concatenate()([x, block_features[-3]])

    x = layers.Conv2DTranspose(32, (4, 4), strides=2, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)

    x = layers.Conv2DTranspose(32, (4, 4), strides=2, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)

    x = layers.Conv2D(32, (3, 3), padding='same', activation='relu')(x)
    x = layers.Conv2D(32, (3, 3), padding='same', activation='relu')(x)

    seg_output = layers.Conv2D(
        NUM_SEGMENTATION_CHANNELS, 
        (1, 1), 
        activation='sigmoid', 
        name='segmentation'
    )(x)

    y = layers.Conv2D(64, (3, 3), padding='same')(base_model.output)
    y = layers.BatchNormalization()(y)
    y = layers.ReLU()(y)
    y = layers.Flatten()(y)
    y = layers.Dense(256, activation='relu')(y)
    lm_output = layers.Dense(NUM_LANDMARKS * 2, name='landmarks')(y)
    
    return Model(inputs=input_image, outputs=[seg_output, lm_output])

model = build_finetuning_model()
model.load_weights('backend/final_model.h5')

# Adjust this based on your model's expected input size
IMAGE_SIZE = (256, 256)

def preprocess_image(pil_image):
    # Convert PIL image to OpenCV format (NumPy array in BGR)
    img = np.array(pil_image)
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    # Resize to model input size
    img = cv2.resize(img, IMAGE_SIZE)

    # Normalize
    img = img.astype(np.float32) / 255.0

    # Add batch dimension
    return np.expand_dims(img, axis=0)

# Segment result using mask
def crop_segmented_region(original_img, seg_mask, target_channel=0):
    # Resize seg_mask to match original image size
    orig_height, orig_width = original_img.shape[:2]
    mask = cv2.resize(seg_mask[:, :, target_channel], (orig_width, orig_height))
    
    # Threshold the mask to create binary mask
    binary_mask = (mask > 0.5).astype(np.uint8) * 255

    # Create 3-channel mask
    mask_3ch = cv2.merge([binary_mask]*3)

    # Apply mask to the image
    cropped_img = cv2.bitwise_and(original_img, mask_3ch)

    return cropped_img

def save_segmented_pil(segmented_img_cv2):
    # Convert from OpenCV (BGR) to PIL (RGB)
    image = Image.fromarray(cv2.cvtColor(segmented_img_cv2, cv2.COLOR_BGR2RGBA))

    # Convert black background to transparent
    datas = image.getdata()
    newData = []
    for item in datas:
        if item[:3] == (0, 0, 0):  # Detect black
            newData.append((0, 0, 0, 0))  # Transparent
        else:
            newData.append(item)
    image.putdata(newData)

    # Save to base64 PNG
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    base64_img = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return f"data:image/png;base64,{base64_img}"

def predict(pil_image):
    img = preprocess_image(pil_image)
    seg_pred, lm_pred = model.predict(img)

    # Convert PIL image to OpenCV (BGR)
    orig_img = np.array(pil_image)
    orig_img = cv2.cvtColor(orig_img, cv2.COLOR_RGB2BGR)

    # Crop segmented region (adjust target_channel if needed)
    segmented_img = crop_segmented_region(orig_img, seg_pred[0], target_channel=0)

    # Convert back to RGB for PIL saving
    segmented_img_rgb = cv2.cvtColor(segmented_img, cv2.COLOR_BGR2RGB)
    segmented_image = Image.fromarray(segmented_img_rgb)

    # Save to in-memory buffer
    buffer = BytesIO()
    segmented_image.save(buffer, format="PNG")

    # Save using PIL - For debugging
    # segmented_pil.save("segmented_output.png")

    # Convert normalized landmarks (0-1) to pixel coordinates
    orig_height, orig_width = orig_img.shape[:2]
    landmarks = lm_pred[0].reshape(-1, 2)
    pixel_landmarks = landmarks * [orig_width, orig_height]
    flatten_landmark = pixel_landmarks.flatten()

    return seg_pred[0], flatten_landmark, segmented_img

def visualize_results(image_path, seg_mask, landmarks):
    orig_img = cv2.imread(image_path)
    orig_img = cv2.cvtColor(orig_img, cv2.COLOR_BGR2RGB)

    img_resized = cv2.resize(orig_img, IMAGE_SIZE)
    
    plt.figure(figsize=(18, 6))

    plt.subplot(1, 3, 1)
    plt.imshow(img_resized)
    plt.title('Original Image')
    plt.axis('off')

    plt.subplot(1, 3, 2)
    overlay = np.zeros_like(img_resized)
    colors = [(255,0,0), (0,255,0), (0,0,255)]
    for i in range(NUM_SEGMENTATION_CHANNELS):
        mask = (seg_mask[:, :, i] > 0.5).astype(np.uint8)
        overlay[mask == 1] = colors[i]
    plt.imshow(cv2.addWeighted(img_resized, 0.7, overlay, 0.3, 0))
    plt.title('Segmentation')
    plt.axis('off')

    plt.subplot(1, 3, 3)
    plt.imshow(img_resized)

    lm = landmarks.reshape(-1, 2)

    x_coords = lm[:, 0] * IMAGE_SIZE[1]
    y_coords = lm[:, 1] * IMAGE_SIZE[0]

    for x, y in zip(x_coords, y_coords):
        plt.scatter(x, y, s=40, c='cyan', edgecolors='black', linewidths=0.5)
    
    plt.title('Landmarks')
    plt.axis('off')
    
    plt.tight_layout()
    plt.show()

    return list(zip(x_coords, y_coords))

def visualize_on_original(image_path, seg_mask, landmarks):
    orig_img = cv2.imread(image_path)
    if orig_img is None:
        raise ValueError(f"Image not found: {image_path}")
    
    orig_img = cv2.cvtColor(orig_img, cv2.COLOR_BGR2RGB)
    orig_height, orig_width = orig_img.shape[:2]

    vis_img = orig_img.copy()

    lm = landmarks.reshape(-1, 2)

    x_coords = lm[:, 0] * orig_width
    y_coords = lm[:, 1] * orig_height

    for x, y in zip(x_coords, y_coords):
        cv2.circle(vis_img, (int(x), int(y)), 5, (0, 255, 255), -1)
        cv2.circle(vis_img, (int(x), int(y)), 6, (0, 0, 0), 1)

    resized_seg_mask = np.zeros((orig_height, orig_width, NUM_SEGMENTATION_CHANNELS))
    for i in range(NUM_SEGMENTATION_CHANNELS):
        channel = cv2.resize(seg_mask[:, :, i], (orig_width, orig_height))
        resized_seg_mask[:, :, i] = (channel > 0.5).astype(np.uint8)

    overlay = np.zeros_like(vis_img)
    colors = [(255,0,0), (0,255,0), (0,0,255)]
    for i in range(NUM_SEGMENTATION_CHANNELS):
        mask = resized_seg_mask[:, :, i].astype(np.uint8)
        color_mask = np.zeros_like(vis_img)
        color_mask[mask == 1] = colors[i]
        overlay = np.maximum(overlay, color_mask)

    seg_img = cv2.addWeighted(vis_img, 0.7, overlay, 0.3, 0)

    plt.figure(figsize=(18, 6))
    
    plt.subplot(1, 3, 1)
    plt.imshow(orig_img)
    plt.title('Original Image')
    plt.axis('off')
    
    plt.subplot(1, 3, 2)
    plt.imshow(seg_img)
    plt.title('Segmentation on Original')
    plt.axis('off')
    
    plt.subplot(1, 3, 3)
    plt.imshow(vis_img)
    plt.title('Landmarks on Original')
    plt.axis('off')
    
    plt.tight_layout()

    # Save the figure
    plt.savefig('output_plot.png', dpi=300, bbox_inches='tight')  # Change filename and dpi as needed 

    return list(zip(x_coords, y_coords))