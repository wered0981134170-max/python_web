// ===== 常數 =====
const TOTAL_QUESTIONS = 10      // 總題數
const STABLE_MS       = 800     // 手勢穩定判定時間（毫秒）
const BOSS_MAX_HP     = 10      // Boss 最大血量（全局共用）

// ===== 狀態 =====
let answered       = false
let isFetching     = false
let inBossAnim     = false      // Boss 攻擊動畫播放中，暫停答題

// 手勢穩定
let lastGesture    = null
let gestureTimer   = null
let gestureStart   = null

// Boss（整局共用，不重置）
let bossHp         = BOSS_MAX_HP

// Combo（Boss 攻擊畫面用）
let gestureSequence = []
let lastGestureBoss = null
let skillActivating = false
let bossMode        = false     // true = 正在 Boss 攻擊畫面

// 進度
let currentQ = 0

// ===== DOM 快取 =====
let videoFeed, videoFeedBoss, gestureText, resultEl
let answerHint, ringArc, ringGesture, stabilityRing

// ===== 初始化 =====
window.onload = function(){

    videoFeed     = document.getElementById("videoFeed")
    videoFeedBoss = document.getElementById("videoFeedBoss")
    gestureText   = document.getElementById("gesture")
    resultEl      = document.getElementById("result")
    answerHint    = document.getElementById("answerHint")
    ringArc       = document.getElementById("ringArc")
    ringGesture   = document.getElementById("ringGesture")
    stabilityRing = document.getElementById("stabilityRing")

    updateProgress()
    updateBossHp()
    loadQuestion()

    // 攝影機永遠跑，60ms 一幀
    setInterval(updateVideo, 60)
}


// ===== 進度條 =====
function updateProgress(){
    const pct = (currentQ / TOTAL_QUESTIONS) * 100
    document.getElementById("progressBar").style.width = pct + "%"
    document.getElementById("progressText").innerText  =
        "第 " + (currentQ + 1) + " / " + TOTAL_QUESTIONS + " 題"
}


// ===== 題目 =====
async function loadQuestion(){

    answered = false
    resetGestureState()

    try {
        const res  = await fetch("/get_question")
        if (!res.ok) throw new Error("HTTP " + res.status)
        const data = await res.json()

        document.getElementById("question").innerText = data.question

        for(let i = 1; i <= 4; i++){
            document.getElementById("opt" + i).innerText = i + ". " + data.choices[i - 1]
        }

        resultEl.innerText    = ""
        resultEl.className    = ""
        answerHint.innerText  = ""
        gestureText.innerText = ""

    } catch(e) {
        console.error("loadQuestion 失敗:", e)
        setTimeout(loadQuestion, 3000)
    }
}


// ===== 攝影機（永遠更新，同時餵給答題畫面和 Boss 畫面）=====
async function updateVideo(){

    if(isFetching) return
    isFetching = true

    try {
        const res  = await fetch("/video_frame")
        if (!res.ok) throw new Error("HTTP " + res.status)
        const data = await res.json()

        // ★ 兩個 img 共用同一幀，攝影機不中斷
        const imgSrc = "data:image/jpeg;base64," + data.image
        videoFeed.src     = imgSrc
        videoFeedBoss.src = imgSrc

        // ===== Boss 攻擊畫面：偵測 Combo =====
        if(bossMode){
            if(data.gesture) detectCombo(data.gesture)
            return
        }

        // ===== 答題模式 =====
        if(answered || inBossAnim) return

        clearHighlight()

        if(data.gesture){

            gestureText.innerText = "手勢: " + data.gesture
            highlightOption(data.gesture)

            if(data.gesture === lastGesture){
                updateRing(data.gesture)

            } else {
                cancelGestureTimer()
                lastGesture  = data.gesture
                gestureStart = Date.now()

                gestureTimer = setTimeout(() => {
                    if(!answered && !inBossAnim){
                        answered = true
                        hideRing()
                        submitAnswer(lastGesture)
                    }
                }, STABLE_MS)
            }

        } else {
            cancelGestureTimer()
            lastGesture = null
            gestureText.innerText = ""
        }

    } catch(e) {
        console.error("updateVideo 失敗:", e)
    } finally {
        isFetching = false
    }
}


// ===== 進度環 =====
function updateRing(gesture){
    if(!gestureStart) return
    const elapsed = Date.now() - gestureStart
    const pct     = Math.min(elapsed / STABLE_MS, 1)
    const CIRC    = 157
    ringArc.style.strokeDashoffset = CIRC * (1 - pct)
    ringGesture.innerText          = gesture
    stabilityRing.classList.remove("hidden")
}

function hideRing(){
    stabilityRing.classList.add("hidden")
    ringArc.style.strokeDashoffset = 157
}

function cancelGestureTimer(){
    if(gestureTimer !== null){
        clearTimeout(gestureTimer)
        gestureTimer = null
    }
    gestureStart = null
    hideRing()
}


// ===== 作答 =====
async function submitAnswer(gesture){

    try {
        const res  = await fetch("/check_answer/" + gesture)
        if (!res.ok) throw new Error("HTTP " + res.status)
        const data = await res.json()

        if(data.correct){

            // ✅ 答對：顯示結果 → 進入 Boss 攻擊畫面
            resultEl.innerText = "✅ 正確！"
            resultEl.className = "correct"
            answerHint.innerText = ""

            currentQ++
            updateProgress()

            setTimeout(showBossAttack, 600)

        } else {

            // ❌ 答錯：Boss 說出正確答案，不扣血，繼續下一題
            resultEl.innerText = "❌ 答錯了！"
            resultEl.className = "wrong"

            // data.correct_answer 由後端回傳正確答案文字
            const hint = data.correct_answer
                ? "👹 魔王：正確答案是「" + data.correct_answer + "」！"
                : "👹 魔王：哈哈，答錯了！"
            answerHint.innerText = hint

            setTimeout(loadQuestion, 2500)
        }

    } catch(e) {
        console.error("submitAnswer 失敗:", e)
        answered = false
        resultEl.innerText = "⚠️ 網路錯誤，請重試"
        setTimeout(loadQuestion, 2000)
    }
}


// ===== Boss 攻擊畫面（答對後短暫顯示）=====
function showBossAttack(){

    bossMode        = true
    skillActivating = false
    gestureSequence = []
    lastGestureBoss = null

    // 切換到 Boss 畫面（攝影機繼續透過 videoFeedBoss 顯示）
    document.getElementById("quizContainer").classList.add("hidden")
    document.getElementById("bossArea").classList.remove("hidden")
    document.getElementById("bossImg").src         = "/static/boss_idle.png"
    document.getElementById("skillText").innerText = "比出攻擊手勢！"
    document.getElementById("comboDisplay").innerText = ""
}


// ===== Boss 血條 =====
function updateBossHp(){
    const pct = (bossHp / BOSS_MAX_HP) * 100
    document.getElementById("bossHpBar").style.width = pct + "%"
    document.getElementById("bossHpText").innerText  = bossHp + " / " + BOSS_MAX_HP

    // 血條顏色：高血量綠 → 低血量紅
    const bar = document.getElementById("bossHpBar")
    if(pct > 60)      bar.style.background = "linear-gradient(90deg,#27ae60,#2ecc71)"
    else if(pct > 30) bar.style.background = "linear-gradient(90deg,#e67e22,#f39c12)"
    else              bar.style.background = "linear-gradient(90deg,#c0392b,#e74c3c)"
}


// ===== Combo 偵測 =====
function detectCombo(g){

    if(skillActivating) return
    if(g === lastGestureBoss) return

    lastGestureBoss = g
    gestureSequence.push(g)
    if(gestureSequence.length > 4) gestureSequence.shift()

    // Hit 特效
    const el = document.getElementById("comboDisplay")
    el.classList.remove("hit")
    void el.offsetWidth
    el.innerText = g
    el.classList.add("hit")
    el.onanimationend = () => {
        el.classList.remove("hit")
        el.innerText = ""
    }

    const combo = gestureSequence.join("")
    if(combo.endsWith("1234"))      activateSkill(1)
    else if(combo.endsWith("4321")) activateSkill(2)
}


// ===== 技能觸發 =====
function activateSkill(type){

    skillActivating = true
    gestureSequence = []
    lastGestureBoss = null

    const boss = document.getElementById("bossImg")
    const text = document.getElementById("skillText")

    if(type === 1){
        text.innerText = "🔥 火焰斬擊！"
        boss.src       = "/static/boss_hit1.gif"
    } else {
        text.innerText = "⚡ 雷電爆破！"
        boss.src       = "/static/boss_hit2.gif"
    }

    // 扣 1 滴血
    bossHp = Math.max(0, bossHp - 1)
    updateBossHp()

    setTimeout(() => {
        bossMode        = false
        skillActivating = false

        // 回到答題畫面
        document.getElementById("bossArea").classList.add("hidden")
        document.getElementById("quizContainer").classList.remove("hidden")

        if(bossHp <= 0 && currentQ >= TOTAL_QUESTIONS){
            showFinalResult()
        } else if(bossHp <= 0){
            // Boss 死但題目還沒答完（理論上 10題=10血，同步完成）
            showFinalResult()
        } else {
            loadQuestion()
        }

    }, 2000)
}


// ===== 全部完成 =====
function showFinalResult(){

    bossMode = false
    document.getElementById("bossArea").classList.add("hidden")
    document.getElementById("quizContainer").classList.remove("hidden")

    document.getElementById("progressText").innerText  = "🎉 全部完成！"
    document.getElementById("progressBar").style.width = "100%"
    document.getElementById("question").innerText      = "恭喜你打倒魔王！"
    gestureText.innerText  = ""
    answerHint.innerText   = ""
    resultEl.innerText     = ""

    for(let i = 1; i <= 4; i++){
        document.getElementById("opt" + i).innerText = ""
    }
}


// ===== UI 工具 =====
function highlightOption(n){
    clearHighlight()
    const btn = document.getElementById("opt" + n)
    if(btn) btn.classList.add("active")
}

function clearHighlight(){
    for(let i = 1; i <= 4; i++){
        document.getElementById("opt" + i).classList.remove("active")
    }
}

function resetGestureState(){
    cancelGestureTimer()
    lastGesture = null
}
