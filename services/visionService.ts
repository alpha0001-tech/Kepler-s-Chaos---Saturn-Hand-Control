import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

let handLandmarker: HandLandmarker | undefined;
let lastVideoTime = -1;

export const initializeVision = async (): Promise<void> => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
};

export const detectHand = (video: HTMLVideoElement): { openness: number, isDetected: boolean } => {
  if (!handLandmarker) return { openness: 0, isDetected: false };

  if (video.currentTime !== lastVideoTime) {
    const startTimeMs = performance.now();
    const result: HandLandmarkerResult = handLandmarker.detectForVideo(video, startTimeMs);
    lastVideoTime = video.currentTime;

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];

      // Calculate openness based on distance of fingertips to wrist
      // Wrist is index 0. Tips are 4 (Thumb), 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];

      const getDist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

      // Average distance of tips from wrist
      const avgDist = (
        getDist(thumbTip, wrist) +
        getDist(indexTip, wrist) +
        getDist(middleTip, wrist) +
        getDist(ringTip, wrist) +
        getDist(pinkyTip, wrist)
      ) / 5;

      // Normalize based on heuristic values (approximate for hand near camera)
      // 0.2 is roughly a closed fist, 0.5 is roughly an open palm in normalized coords
      const minVal = 0.2;
      const maxVal = 0.55; 
      
      let openness = (avgDist - minVal) / (maxVal - minVal);
      openness = Math.max(0, Math.min(1, openness));

      return { openness, isDetected: true };
    }
  }

  return { openness: 0, isDetected: false };
};