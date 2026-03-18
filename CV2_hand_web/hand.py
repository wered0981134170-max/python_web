import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2
import time

class HandDetector:

    def __init__(self):

        base_options = python.BaseOptions(
            model_asset_path=r"C:\python_idiom\b_H\hand_landmarker.task"
        )

        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=1,
            running_mode=vision.RunningMode.VIDEO
        )

        self.landmarker = vision.HandLandmarker.create_from_options(options)

        self.timestamp = 0

        self.last_gesture = None
        self.gesture_stable_since = None

        self.countdown_start = None
        self.countdown_target = None

        self.STABLE_THRESHOLD = 1.0
        self.COUNTDOWN_SECONDS = 3


    def classify_gesture(self, landmarks, hand_label):

        tips = [8,12,16,20]
        pip = [6,10,14,18]

        count = 0

        for t,p in zip(tips,pip):
            if landmarks[t].y < landmarks[p].y:
                count+=1

        if hand_label == "Right":
            if landmarks[4].x > landmarks[3].x:
                count+=1
        else:
            if landmarks[4].x < landmarks[3].x:
                count+=1

        return str(count)


    def process(self,frame):

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb
        )

        result = self.landmarker.detect_for_video(mp_image,self.timestamp)
        self.timestamp +=1

        current_gesture = None

        if result.hand_landmarks:

            hand = result.hand_landmarks[0]
            hand_label = result.handedness[0][0].category_name

            current_gesture = self.classify_gesture(hand,hand_label)

            for lm in hand:

                x = int(lm.x*frame.shape[1])
                y = int(lm.y*frame.shape[0])

                cv2.circle(frame,(x,y),5,(255,0,0),-1)

        now = time.time()

        if current_gesture != self.last_gesture:

            self.last_gesture = current_gesture
            self.gesture_stable_since = now
            self.countdown_start = None

        else:

            if current_gesture and self.gesture_stable_since:

                stable = now - self.gesture_stable_since

                if self.countdown_start is None and stable >= self.STABLE_THRESHOLD:

                    self.countdown_start = now
                    self.countdown_target = current_gesture

        if current_gesture:

            cv2.putText(frame,f"Number: {current_gesture}",
            (20,50),cv2.FONT_HERSHEY_SIMPLEX,1.5,(0,255,0),3)

        if self.countdown_start:

            elapsed = now - self.countdown_start
            remain = self.COUNTDOWN_SECONDS - elapsed

            if remain > 0:

                display = int(remain)+1

                cv2.putText(frame,f"Countdown: {display}",
                (20,110),cv2.FONT_HERSHEY_SIMPLEX,1.5,(0,100,255),3)

            else:

                cv2.putText(frame,f"GO! [{self.countdown_target}]",
                (20,110),cv2.FONT_HERSHEY_SIMPLEX,2,(0,0,255),4)

                if now-self.countdown_start >= self.COUNTDOWN_SECONDS+1:

                    self.countdown_start = None

        return frame