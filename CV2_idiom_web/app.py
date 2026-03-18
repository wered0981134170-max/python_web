from flask import Flask, render_template, jsonify
import cv2
import base64

from hand_detector import HandDetector
from idiom_quiz import new_question

app = Flask(__name__)

detector = HandDetector()
cap = cv2.VideoCapture(0)
question = new_question()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_question")
def get_question():
    return jsonify(question)


@app.route("/check_answer/<int:gesture>")
def check_answer(gesture):
    global question

    # ✅ 先比對，再換題（原本換題在比對前，導致比對到下一題）
    correct = (gesture == question["correct_index"])
    correct_answer = question["correct_char"]

    result = {
        "correct": correct,
        "correct_answer": correct_answer
    }

    question = new_question()   # 比對完才換題
    return jsonify(result)


@app.route("/video_frame")
def video_frame():
    global cap

    ret, frame = cap.read()
    if not ret:
        return ""

    frame = cv2.flip(frame, 1)
    gesture, frame = detector.detect(frame)

    _, buffer = cv2.imencode('.jpg', frame)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')

    return jsonify({
        "image": jpg_as_text,
        "gesture": gesture
    })


if __name__ == "__main__":
    app.run(debug=True)
