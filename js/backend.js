let lastCheckAt = new Date();
const checkIntervalMillis = 2 * 60 * 1000;

const googleAPICalendarURL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

const getAuthToken = () => {
    console.log("Authenticating...")

    return chrome.identity.getAuthToken({'interactive': false})
        .then((tokenObject) => tokenObject.token)
}

const getGoogleMeetings = (token) => {
    console.log("Executing...")

    function openURL(url) {
        return chrome.tabs.query({}, function(tabs) {
            // Check if meeting is not already opened. Skip if it is.
             if (tabs.some((tab) => tab.url.includes(url))) {
                 console.log("Tab is already opened with url!")
             } else {
                 // TODO: Define appropriate time frame to search, should be dependant on a meeting time ideally
                 let oneHourAgo = (new Date()).getTime() - 1000 * 60 * 60;
                 // Check if meeting was not already attended - check if url exists in history. Skip if it is.
                 chrome.history.search({text: url, startTime: oneHourAgo}, function(data) {
                    if (data.length > 0) {
                        console.log("Meeting exists in history")
                    } else {
                        // Open a meeting!
                        chrome.tabs.create({url: url}, function (tab) {
                            chrome.windows.update(tab.windowId, {focused: true}).then(() => {})
                        })
                    }
                 });
             }
        })
    }

    const headers = new Headers({
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    })

    const dateNow = new Date();

    const queryAdditionalParams = new URLSearchParams({
        timeMin: dateNow.toISOString(),
        timeMax: new Date(dateNow.getTime() + checkIntervalMillis).toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
    });

    const queryParams = {
        headers
    };

    fetch(`${googleAPICalendarURL}?${queryAdditionalParams}`, queryParams)
        .then((response) => response.json())
        .then(function (data) {
            let invites = data.items.filter((invite) => 'hangoutLink' in invite)

            // Filter meetings that were declined
            // TODO: Make a settings which meeting join or not to join, some list: declined, tentative etc.
            invites = invites.filter((invite) =>
                invite.attendees.some((attendee) => 'self' in attendee && attendee.responseStatus !== 'declined')
            )

            if (invites.length > 1) {
                const overlappingMeets = invites.map((invite) => {
                        return {
                            title: invite.summary ? invite.summary : '(No title)',
                            message: invite.organizer.email
                        }
                    })

                chrome.notifications.create("overlappingMeetingsNotification", {
                    type: "list",
                    iconUrl: "../icon.png",
                    title: `${overlappingMeets.length} Overlapping Meetings!`,
                    message: '',
                    // TODO: macOS will show only first row, unfortunately, think how we can prioritise smart. Created at?
                    items: overlappingMeets,
                    requireInteraction: true
                });
            }

            for (let item of invites) {
                openURL(item.hangoutLink)
            }
        })
}

const authAndExecute = () => {
    getAuthToken().then((token => getGoogleMeetings(token)))
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

// For development purposes
// chrome.storage.local.clear();

setInterval(runIfExtensionEnabled, 10 * 1000);
