let lastCheckAt = new Date();
const checkIntervalMillis = 2 * 60 * 1000;

const googleAPICalendarURL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

const getAuthToken = (interactive) => {
    console.log("Authenticating...")

    return chrome.identity.getAuthToken({'interactive': interactive})
        .then((tokenObject) => tokenObject.token)
}

const notifyOverlappingMeets = (invites) => {
    const overlappingMeets = invites.map((invite) => {
        return {
            title: invite.summary ? invite.summary : '(No title)',
            message: invite.organizer.email
        }
    })

    chrome.notifications.create("overlappingMeetingsNotification", {
        type: "list",
        iconUrl: "../images/icon.png",
        title: `${overlappingMeets.length} Overlapping Meetings!`,
        message: '',
        // TODO: macOS will show only first row, unfortunately, think how we can prioritise smart. Created at?
        items: overlappingMeets,
        requireInteraction: true
    });
}

const getGoogleMeetings = (token) => {
    console.log("Executing...")

    function openURL(url) {
        chrome.tabs.create({url: url}, function (tab) {
            chrome.windows.update(tab.windowId, {focused: true}).then(() => {})
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
                (
                    'attendees' in invite
                    && invite.attendees.some((attendee) => 'self' in attendee && attendee.responseStatus !== 'declined')
                )
                || ('organizer' in invite && 'self' in invite.organizer)
            )

            chrome.tabs.query({}, function(tabs) {
                // Filter already opened meetings
                invites = invites.filter((invite) =>
                    tabs.every((tab) => !tab.url.includes(invite.hangoutLink))
                )

                // TODO: Define appropriate time frame to search, should be dependant on a meeting time ideally
                let oneHourAgo = (new Date()).getTime() - 1000 * 60 * 60 * 2;

                chrome.history.search({text: '', startTime: oneHourAgo}, function(data) {
                    // Filter already attended meetings
                    invites = invites.filter(
                        (invite) => data.every((history) => !history.url.includes(invite.hangoutLink))
                    )

                    // Notify user about overlapping meetings
                    if (invites.length > 1) notifyOverlappingMeets(invites)

                    // Open all meetings that survived till here
                    invites.forEach(invite => openURL(invite.hangoutLink))
                });
            })
        })
}

const authAndExecute = () => {
    getAuthToken(false).then((token => getGoogleMeetings(token)))
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

// Upon installation or update initiate interactive authentication
chrome.runtime.onInstalled.addListener(function(details){
    console.log(details);
    if (details.reason === "install" || details.reason === "update") {
        getAuthToken(true)
    }
});

// For development purposes
// chrome.storage.local.clear();

setInterval(runIfExtensionEnabled, 10 * 1000);
