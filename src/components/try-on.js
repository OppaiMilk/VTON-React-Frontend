/* global cv */
export class TryOnProcessor {
    processKeypoint(segmentation) {
        const { allPoses, width, height } = segmentation;
        const keypoints = allPoses?.[0]?.keypoints || [];

        // Helper to find a keypoint by part name
        const getPoint = (part) => keypoints.find(kp => kp.part === part) || { position: { x: 0, y: 0 } };

        // The order of the pose is based on DeepFashion2 shirt keypoint numbering
        const pose = {
        // leftElbow: getPoint('leftElbow'),
        // rightElbow: getPoint('rightElbow'),
        // leftWrist: getPoint('leftWrist'),
        // rightWrist: getPoint('rightWrist'),
        leftShoulder: getPoint('leftShoulder'),
        leftHip: getPoint('leftHip'),
        rightHip: getPoint('rightHip'),
        rightShoulder: getPoint('rightShoulder')
        };

        // Convert to array of {x, y} only
        const flat = Object.values(pose).map(p => ({
        x: p.position?.x || 0,
        y: p.position?.y || 0
        }));

        // Flat is the flattern array (REMEMBER, OPENCV ONLY TAKE FLAT ARRAY)
        return {
        pose, flat
        };
    }

    // Mark the keypoints on the shirt
    markPointOnShirt(image, uploadWidth, uploadHeight, landmarkData) {
        const targetWidth = 640;
        const targetHeight = 480;

        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        // Resize image to match height and preserve aspect ratio
        const imageAspect = image.width / image.height;
        const drawHeight = targetHeight;
        const drawWidth = targetHeight * imageAspect;

        // Center image horizontally on canvas
        const offsetX = (targetWidth - drawWidth) / 2;
        const offsetY = 0;

        // Draw resized image on canvas
        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

        // Scale factors for landmark transformation
        const scaleX = drawWidth / uploadWidth;
        const scaleY = drawHeight / uploadHeight;
        // Style for landmark points
        ctx.fillStyle = "yellow";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;

        // Draw landmarks and transform coordinates
        const coords = landmarkData.landmarks;

        // These are the shirt point refer from DeepFashion2
        const selectedIndices = [6, 14, 16, 24];
        const selectedLandmarks = [];

        // for (let i = 0; i < coords.length; i += 2) {
        //   const x = coords[i] * scaleX + offsetX;
        //   const y = coords[i + 1] * scaleY + offsetY;

        //   landmark.push({ x, y });

        //   ctx.beginPath();
        //   ctx.arc(x, y, 5, 0, 2 * Math.PI);
        //   ctx.fill();
        //   ctx.stroke();
        // }

        for (const index of selectedIndices) {
            const x = coords[index * 2] * scaleX + offsetX;
            const y = coords[index * 2 + 1] * scaleY + offsetY;

            selectedLandmarks.push({ x, y });

            // // Draw circle at each selected point
            // ctx.beginPath();
            // ctx.arc(x, y, 5, 0, 2 * Math.PI);
            // ctx.fill();
            // ctx.stroke();
        }

        console.log("Original landmark:", coords);
        console.log("Transformed landmark:", selectedLandmarks);
        console.log(`Draw width: ${ drawWidth } x ${ drawHeight }`)
        
        // selectedLandmark
        // [0] top left
        // [1] bottom left
        // [2] bottom right
        // [3] top right
        return { 
        canvasWithPoints: canvas,
        fourPoints: [selectedLandmarks[0], selectedLandmarks[1], selectedLandmarks[2], selectedLandmarks[3]]
        };
    }

    applyPerspectiveTransform(shirtCanvas, srcPoint, dstPoint, outputWidth, outputHeight) {
        function flattenPointArray(points) {
            return points.flatMap(pt => [pt.x, pt.y]);
        }

        const transformedCanvas = document.createElement("canvas");
        transformedCanvas.width = outputWidth;
        transformedCanvas.height = outputHeight;

        const srcFlat = flattenPointArray(srcPoint);
        const dstFlat = flattenPointArray(dstPoint);

        const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcFlat);
        const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstFlat);

        // Read shirtCanvas into OpenCV
        const src = cv.imread(shirtCanvas); // shirtCanvas is an HTMLCanvasElement
        const dst = new cv.Mat();
        const dsize = new cv.Size(outputWidth, outputHeight);

        const M = cv.getPerspectiveTransform(srcMat, dstMat);
        cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));

        cv.imshow(transformedCanvas, dst);

        // Clean up
        src.delete(); dst.delete(); M.delete(); srcMat.delete(); dstMat.delete();

        console.log("srcpoint:", srcFlat);
        console.log("dstpoint:", dstFlat);
        console.log(`Dimension: ${ outputWidth } x ${ outputHeight }`);

        return transformedCanvas;
    }
}