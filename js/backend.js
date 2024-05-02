let lastCheckAt = new Date();
let checkIntervalMillis = 2 * 60 * 1000;

const getGoogleMeetings = (token) => {
    function openURL(url) {
        return chrome.tabs.query({}, function(tabs) {
            for (let i = 0; i < tabs.length; ++i) {
                if (tabs[i].url.toString().includes(url)) {
                    return;
                }
            }
            chrome.tabs.create({url: url}, function (tab) {
                chrome.windows.update(tab.windowId, { focused: true });
            });
        })
    }

    console.log("Executing...")

    const headers = new Headers({
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    })

    let dateNow = new Date();

    const queryAdditionalParams = new URLSearchParams({
        timeMin: dateNow.toISOString(),
        timeMax: new Date(dateNow.getTime() + checkIntervalMillis).toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
    });

    const queryParams = {
        headers
    };

    fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${queryAdditionalParams}`, queryParams)
        .then((response) => response.json())
        .then(function (data) {
            for (let item of data.items) {
                // TODO: Concurrent meeting alert
                if (item.hangoutLink) {
                    openURL(item.hangoutLink)
                }
            }
        })
}

const requestAuthToken = () => {
    return chrome.identity.getAuthToken({'interactive': false}).then((tokenObject) => {
        chrome.storage.local.set({ extensionSettings: {"authToken": tokenObject.token} }).then(() => {
            console.log('Successfully saved the token: ' + tokenObject.token);
        });
        return tokenObject.token;
    })
}

const authAndExecute = () => {
    console.log("Authenticating...")
    chrome.storage.local.get(["extensionSettings"]).then((result) => {
        if (result.extensionSettings === undefined || result.extensionSettings.authToken === undefined) {
            console.log("No extension settings found, or token not found. Requesting...")
            requestAuthToken().then((token => getGoogleMeetings(token)))
        } else {
            console.log("Token found in local storage.")
            getGoogleMeetings(result.extensionSettings.authToken)
        }
    });
}

const runIfExtensionEnabled = () => {
    chrome.storage.local.get(["extensionSettings"]).then((result) => {
        if (result.extensionSettings === undefined || result.extensionSettings.isOn === undefined || result.extensionSettings.isOn === true) {
            console.log("Extension is set to 'on'")

            if (new Date().getTime() > lastCheckAt.getTime()) {
                authAndExecute()
                lastCheckAt = new Date(lastCheckAt.getTime() + checkIntervalMillis);
            } else {
                console.log("Skipping, because check already was done in " + checkIntervalMillis + "ms")
            }


        } else {
            console.log("Extension is set to 'off'");
        }
    });
}

setInterval(runIfExtensionEnabled, 10 * 1000)
