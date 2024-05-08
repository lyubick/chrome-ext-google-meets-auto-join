const button = document.getElementById('powerButton');

const syncButtonText = () => {
    chrome.storage.local.get(["extensionSettings"]).then(
        (result) => button.innerHTML = result.extensionSettings.isOn ? "Stop" : "Start"
    )
}

const setState = (isOn) => {
    chrome.storage.local.set({ extensionSettings: { "isOn": isOn } }).then(
        () => syncButtonText()
    )
}

// Callback on button click event
button.onclick = async () => {
    chrome.storage.local.get(["extensionSettings"]).then(
        (result) => setState(!result.extensionSettings.isOn)
    )
}

const initState = () => {
    chrome.storage.local.get(["extensionSettings"]).then((result) => {
        (result.extensionSettings === undefined || result.extensionSettings.isOn === true) ?
            setState(true) : setState(false)
    })
}

initState()
