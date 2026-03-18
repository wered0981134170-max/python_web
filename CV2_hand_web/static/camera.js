const video = document.getElementById("videoFeed")
const statusText = document.getElementById("status")

let running = false


function startCamera(){

    if(running) return

    video.src = "/video"

    statusText.innerText = "攝影機狀態：運行中"

    running = true
}


function stopCamera(){

    video.src = ""

    statusText.innerText = "攝影機狀態：已停止"

    running = false
}