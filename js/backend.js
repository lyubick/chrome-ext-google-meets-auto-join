/** @typedef {Object} Attendee
 *
 * @property {string} responseStatus
 */

/**
 * @typedef {Object} Organizer
 *
 * @property {string} email - The email of the person.
 */

/**
 * @typedef {Object} Invite
 *
 * @property {Attendee[]} attendees - The list of attendees of the meeting.
 * @property {string} hangoutLink - The URL to join the meeting.
 * @property {Organizer} organizer - The organizer of the invite.
 * @property {string} summary - The name of the invite.
 */

let lastCheckAt = new Date();
const checkIntervalMillis = 2 * 60 * 1000;

const googleAPICalendarURL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

const getAuthToken = (interactive) => {
    console.log("Authenticating...")

    return chrome.identity.getAuthToken({'interactive': interactive})
        .then((tokenObject) => tokenObject.token)
}

/**
 *
 * @param {Invite[]} invites
 */
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

let alreadyNotified = []
const notifyEverybodyDeclined = (invite) => {
    console.log(alreadyNotified)

    if (invite.hangoutLink in alreadyNotified) {
        console.log("Notification sent already!")
        return
    }

    chrome.notifications.create("everybodyDeclined", {
        type: "basic",
        iconUrl: "../images/icon.png",
        title: `Everybody declined '${invite.summary ? invite.summary : '(No title)'}' @ ${invite.start.dateTime.toLocaleString()}`,
        message: '',
        requireInteraction: true
    });

    alreadyNotified.push(invite.hangoutLink)
}

let alreadyScheduled = []
const getGoogleMeetings = async (token) => {
    console.log("Executing...")

    function callbackOpenURL(URL) {
        chrome.tabs.create({url: URL}, function (tab) {
            chrome.windows.update(tab.windowId, {focused: true}).then(() => {})
        })
    }

    function openURL(invite) {
        chrome.storage.local.get(["extensionSettingsTime"]).then(
            (result) => {
                let timeDifference = (new Date()).getTime() - new Date(invite.start.dateTime).getTime()
                let intervalMS = result.extensionSettingsTime.interval * 1000

                if (timeDifference >= intervalMS) {
                    callbackOpenURL(invite.hangoutLink)
                } else {
                    // Return, if url opening already scheduled
                    if (invite.hangoutLink in alreadyScheduled) {
                        console.log("Meeting already scheduled for opening.")
                        return
                    }

                    setTimeout(
                        callbackOpenURL,
                        Math.abs(Math.abs(timeDifference) - Math.abs(intervalMS)),
                        invite.hangoutLink
                    )

                    alreadyScheduled.push(invite.hangoutLink)
                }
            }
        )
    }

    const headers = new Headers({
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    })

    const dateNow = new Date();

    const queryAdditionalParams = new URLSearchParams({
        timeMin: dateNow.toISOString(),
        timeMax: new Date(dateNow.getTime() + checkIntervalMillis).toISOString(),
        singleEvents: "true",
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
            invites = invites.filter((invite) => {
                if ('attendees' in invite) {
                    let user_accepted = invite.attendees.some(
                        (attendee) => 'self' in attendee && attendee.responseStatus !== 'declined'
                    )
                    if (user_accepted) {
                        let others_accepted = invite.attendees.some(
                            (attendee) => attendee.responseStatus !== 'declined' && !('self' in attendee)
                        )
                        if ((!others_accepted) && user_accepted) notifyEverybodyDeclined(invite)
                        return others_accepted && user_accepted
                    }
                    return false
                } else {
                    return 'organizer' in invite && 'self' in invite.organizer
                }
            });

            chrome.tabs.query({}, function (tabs) {
                // Filter already opened meetings
                invites = invites.filter((invite) =>
                    tabs.every((tab) => !tab.url.includes(invite.hangoutLink))
                )

                // TODO: Define appropriate time frame to search, should be dependant on a meeting time ideally
                let oneHourAgo = (new Date()).getTime() - 1000 * 60 * 60 * 2;

                chrome.history.search({text: '', startTime: oneHourAgo}, function (data) {
                    // Filter already attended meetings
                    invites = invites.filter(
                        (invite) => data.every((history) => !history.url.includes(invite.hangoutLink))
                    )

                    // Notify user about overlapping meetings
                    if (invites.length > 1) notifyOverlappingMeets(invites)

                    // Open all meetings that survived till here
                    invites.forEach(invite => openURL(invite))
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
    if (details.reason === "install" || details.reason === "update") {
        getAuthToken(true)
    }

    if (details.reason === "update") {
        chrome.tabs.create({url: `html/update.html`}).then(() => {})
    }

    // Initialise default settings
    chrome.storage.local.get(["extensionSettingsTime"]).then((result) => {
        if (result.extensionSettingsTime === undefined) {
            chrome.storage.local.set({ extensionSettingsTime: {interval: -2}}).then(() => {})
        }
    })
});

// For development purposes
// chrome.storage.local.clear();

// Alarms are suggested solution to avoid 'inactive' state of the service workers
chrome.alarms.create("triggerCalendarCheck", { periodInMinutes: 10 / 60 }).then(() => {});

chrome.alarms.onAlarm.addListener((alarmName) => {
    if (alarmName.name === "triggerCalendarCheck") runIfExtensionEnabled()
});
