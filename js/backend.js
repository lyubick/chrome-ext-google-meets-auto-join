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
 * @property {string} hangoutLink - The URL to join the Google Meet meeting.
 * @property {string} location - Free text location, may contain a Zoom link.
 * @property {string} description - Free text description, may contain a Zoom link.
 * @property {Object} conferenceData - Conference solution data, Zoom add-on stores its link here.
 * @property {Organizer} organizer - The organizer of the invite.
 * @property {string} summary - The name of the invite.
 * @property {{dateTime: (string|undefined), date: (string|undefined)}} start - Invite's start, timed events have dateTime, all-day ones date
 * @property {{dateTime: (string|undefined), date: (string|undefined)}} end - Invite's end, same shape as start
 *
 * @property {Object} date - Invite's start could be in a form of date or dateTime.
 */

importScripts('join-links.js')

let debug = true;
console.log("Debug mode is " + (debug ? "enabled" : "disabled"))

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;

let lastCheckAt = new Date();
const checkIntervalMillis = TWO_MINUTES_MS;

const googleAPICalendarURL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

const getAuthToken = (interactive) => {
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

// Dedup lists are keyed by meeting id + start time, so a recurring meeting (same link every time) is handled once per
// occurrence. Value is the occurrence start, used for pruning.
const ONE_DAY_MS = 24 * 60 * 60 * 1000

const pruneOld = (map) => {
    const threshold = Date.now() - ONE_DAY_MS
    map.forEach((startMs, key) => {
        if (startMs < threshold) map.delete(key)
    })
}

let alreadyNotified = new Map()
let alreadyNotifiedIgnoredMeet = new Map()

const notifyIgnoredMeet = (invite) => {
    if (alreadyNotifiedIgnoredMeet.has(invite._key)) return

    chrome.notifications.create(`ignoredMeet-${invite._key}`, {
        type: "basic",
        iconUrl: "../images/icon.png",
        title: `Joining Zoom, Google Meet ignored`,
        message: `'${invite.summary ? invite.summary : '(No title)'}' has both Zoom and Google Meet links. Zoom link is used.`,
        requireInteraction: false
    });

    alreadyNotifiedIgnoredMeet.set(invite._key, invite._startMs)
}

const notifyEverybodyDeclined = (invite) => {
    if (alreadyNotified.has(invite._key)) {
        console.log("Notification sent already!")
        return
    }

    let dt = ''

    if ('dateTime' in invite.start) {
        dt = invite.start.dateTime.toLocaleString()
    } else if ('date' in invite.start) {
        dt = invite.start.date.toLocaleString()
    }

    chrome.notifications.create("everybodyDeclined", {
        type: "basic",
        iconUrl: "../images/icon.png",
        title: `Everybody declined '${invite.summary ? invite.summary : '(No title)'}' @ ${dt}`,
        message: '',
        requireInteraction: true
    });

    alreadyNotified.set(invite._key, invite._startMs)
}

let alreadyScheduled = new Map()
const getGoogleMeetings = async (token, flags, providers) => {
    pruneOld(alreadyScheduled)
    pruneOld(alreadyNotified)
    pruneOld(alreadyNotifiedIgnoredMeet)

    console.log("Executing...")

    function callbackOpenURL(URL) {
        chrome.tabs.query({}, function (tabs) {
            if (!tabs.some((tab) => tab.url && tab.url.includes(getMeetingId(URL)))) {
                chrome.tabs.create({url: URL}, function (tab) {
                    chrome.windows.update(tab.windowId, {focused: true}).then(() => {})
                })
            } else {
                console.log(`Meeting ${URL} already opened, skipping.`)
            }
        })
    }

    function openURL(invite) {
        chrome.storage.local.get(["extensionSettingsTime"]).then(
            (result) => {
                let timeDifference = (new Date()).getTime() - new Date(invite.start.dateTime).getTime()
                // Interval is set in minutes in settings, so it is required *60*1000 to convert to MS
                let intervalMS = result.extensionSettingsTime.interval * 60 * 1000

                if (timeDifference >= intervalMS) {
                    callbackOpenURL(invite._join.url)
                } else {
                    // Return, if url opening already scheduled
                    if (alreadyScheduled.has(invite._key)) {
                        console.log("Meeting already scheduled for opening.")
                        return
                    }

                    setTimeout(
                        callbackOpenURL,
                        Math.abs(Math.abs(timeDifference) - Math.abs(intervalMS)),
                        invite._join.url
                    )

                    alreadyScheduled.set(invite._key, invite._startMs)
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

            let invites = data.items.filter((invite) => {
                const link = getJoinLink(invite)
                if (link === null) return false

                // Zoom invite stays a Zoom invite: if Zoom is switched off, it must not fall back to its Meet link
                if (!providers[link.join.provider]) return false

                invite._join = link.join
                invite._ignoredMeet = link.ignoredMeet
                invite._startMs = new Date(invite.start.dateTime || invite.start.date).getTime()
                invite._key = `${link.join.id}|${invite._startMs}`
                return true
            })

            if (debug) {console.log(invites)}

            // Filter meetings that were declined
            invites = invites.filter((invite) => {
                if ('attendees' in invite) {
                    let user_accepted = invite.attendees.some(
                        (attendee) => 'self' in attendee && flags.includes(attendee.responseStatus)
                    )
                    if (user_accepted) {
                        // Corner case when the participant list is hidden cause skipping of a meeting, let's check
                        // if there is only 1 participant do not evaluate the status, because this one is the user
                        // itself.
                        let others_accepted = invite.attendees.length === 1 || invite.attendees.some(
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

            if (debug) {console.log(invites)}

            if (invites.length === 0) return

            let max_diff = Math.max(...invites.map((invite) => {
                return new Date(invite.end.dateTime) - new Date(invite.start.dateTime)
            }))

            if (isNaN(max_diff) || !isFinite(max_diff)) {
                max_diff = TWO_HOURS_MS;
            }

            // Take an additional 15 minutes off in case the meeting was joined earlier
            let twoHoursAgo = (new Date()).getTime() - max_diff - FIFTEEN_MINUTES_MS;

            chrome.history.search({text: '', startTime: twoHoursAgo}, function (data) {
                // Filter already attended meetings
                invites = invites.filter(
                    (invite) => data.every((history) => !history.url.includes(invite._join.id))
                )

                invites.filter((invite) => invite._ignoredMeet).forEach(notifyIgnoredMeet)

                // Notify user about overlapping meetings
                if (invites.length > 1) notifyOverlappingMeets(invites)

                // Open all meetings that survived till here
                invites.forEach(invite => openURL(invite))
            });
        })
}

const readSettingsAndDoBusiness = (token) => {
    chrome.storage.local.get(["extensionSettingsMeetJoinFlags", "extensionSettingsProviders"], (result) => {
        let flags = result.extensionSettingsMeetJoinFlags !== undefined ? result.extensionSettingsMeetJoinFlags.flags : ['accepted', 'tentative', 'needsAction']
        // Provider that was never configured (e.g. Zoom for users who updated) is enabled
        let providers = {meet: true, zoom: true, ...result.extensionSettingsProviders}
        return getGoogleMeetings(token, flags, providers)
    })
}

const authAndExecute = () => {
    getAuthToken(false).then((token => readSettingsAndDoBusiness(token)))
        .catch((error) => console.error("Authentication failed:", error))
}

const runIfExtensionEnabled = () => {
    chrome.storage.local.get(["extensionSettings"]).then((result) => {
        if (result.extensionSettings === undefined || result.extensionSettings.isOn === undefined || result.extensionSettings.isOn === true) {
            if (new Date().getTime() > lastCheckAt.getTime()) {
                authAndExecute()
                lastCheckAt = new Date(lastCheckAt.getTime() + checkIntervalMillis);
            } else {
                console.log("Skipping, because check already was done in " + checkIntervalMillis + "ms")
            }
        }
    });
}

// Upon installation or update initiate interactive authentication
chrome.runtime.onInstalled.addListener(function(details){
    if (details.reason === "install" || details.reason === "update") {
        getAuthToken(true).catch((error) => console.error("Authentication failed:", error))
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
    chrome.storage.local.get(["extensionSettingsProviders"]).then((result) => {
        if (result.extensionSettingsProviders === undefined) {
            chrome.storage.local.set({ extensionSettingsProviders: {meet: true, zoom: true}}).then(() => {})
        }
    })
    chrome.storage.local.get(["extensionSettingsMeetJoinFlags"]).then((result) => {
        if (result.extensionSettingsMeetJoinFlags === undefined) {
            chrome.storage.local.set({ extensionSettingsMeetJoinFlags: {flags: ['accepted', 'tentative', 'needsAction']}}).then(() => {})
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
