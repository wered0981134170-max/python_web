import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2

class HandDetector:

    def __init__(self):

        base_options = python.BaseOptions(
            model_asset_path=r"C:\python_web\CV2_idiom_web\b_H\hand_landmarker.task"
        )

        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=1,
            running_mode=vision.RunningMode.VIDEO
        )

        self.landmarker = vision.HandLandmarker.create_from_options(options)
        self.timestamp = 0

    def classify_gesture(self, landmarks, hand_label):

        tips = [8,12,16,20]
        pip = [6,10,14,18]

        count = 0

        for t,p in zip(tips,pip):
            if landmarks[t].y < landmarks[p].y:
                count += 1

        if hand_label == "Right":
            if landmarks[4].x > landmarks[3].x:
                count += 1
        else:
            if landmarks[4].x < landmarks[3].x:
                count += 1

        return count

    def detect(self, frame):

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb
        )

        result = self.landmarker.detect_for_video(mp_image,self.timestamp)
        self.timestamp += 1

        gesture = None

        if result.hand_landmarks:

            hand = result.hand_landmarks[0]
            hand_label = result.handedness[0][0].category_name

            gesture = self.classify_gesture(hand,hand_label)

            for lm in hand:

                x = int(lm.x*frame.shape[1])
                y = int(lm.y*frame.shape[0])

                cv2.circle(frame,(x,y),4,(255,100,0),-1)

        return gesture, frame