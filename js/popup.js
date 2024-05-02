
document.getElementById('buttonStop').onclick=()=>{
    chrome.storage.local.get(["extensionSettings"]).then((result) => {
        if (result.extensionSettings === undefined) {
            // First time access create storage and switch off the Extension
            chrome.storage.local.set({ extensionSettings: {"isOn": false} }).then(() => {
                document.getElementById("buttonStop").innerHTML = "Start";
            });
        } else if (result.extensionSettings.isOn === true) {
            // Switch off the extension
            chrome.storage.local.set({ extensionSettings: {"isOn": false} }).then(() => {
                document.getElementById("buttonStop").innerHTML = "Start";
            });
        } else {
            // Switch off the extension
            chrome.storage.local.set({ extensionSettings: {"isOn": true} }).then(() => {
                document.getElementById("buttonStop").innerHTML = "Stop";
            });
        }
    });
}
