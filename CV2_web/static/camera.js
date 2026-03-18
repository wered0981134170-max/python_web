const video = document.getElementById("camera")
const statusText = document.getElementById("status")

async function startCamera(){

    try{

        const stream = await navigator.mediaDevices.getUserMedia({
            video:true,
            audio:false
        })

        video.srcObject = stream

        statusText.innerText = "攝影機已啟動"

    }
    catch(err){

        console.error(err)

        statusText.innerText = "攝影機權限被拒絕"

    }

}