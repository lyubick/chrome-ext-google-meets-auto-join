// Pure helpers for finding the video-call link of a calendar invite. No chrome.* usage, so they can be unit tested
// with node (see tests/join-links.test.js).

const ZOOM_URL_REGEX = /https:\/\/(?:[\w-]+\.)*zoom(?:\.us|gov\.com|\.com)\/(?:j|my|wc\/join)\/[^\s"'<>]+/i
const MEET_CODE_REGEX = /[a-z]{3}-[a-z]{4}-[a-z]{3}/

const findZoomURL = (text) => {
    if (typeof text !== 'string') return null

    // Descriptions are often HTML, where "&" in the query string is encoded
    const match = text.replace(/&amp;/g, '&').match(ZOOM_URL_REGEX)
    // Drop punctuation that belongs to the surrounding sentence, not to the link
    return match ? match[0].replace(/[.,;:)\]]+$/, '') : null
}

// Zoom meeting is identified by its numeric ID (or by the name of a personal link), Meet by its meeting code.
// Both survive URL rewriting, so compare by them and not by the whole URL.
const getMeetingId = (URL) => {
    const zoom = URL.match(/zoom[^/]*\/(?:j|wc\/join)\/(\d+)/i) || URL.match(/zoom[^/]*\/my\/([^/?#]+)/i)
    if (zoom) return zoom[1]

    const meet = URL.match(MEET_CODE_REGEX)
    return meet ? meet[0] : URL
}

/**
 * @param {Invite} invite
 * @returns {{provider: string, url: string, id: string}|null}
 */
const getZoomLink = (invite) => {
    const entryPoints = (invite.conferenceData && invite.conferenceData.entryPoints) || []
    const candidates = [
        ...entryPoints.map((entryPoint) => entryPoint.uri),
        invite.location,
        invite.description
    ]

    for (const candidate of candidates) {
        const url = findZoomURL(candidate)
        if (url) return {provider: 'zoom', url, id: getMeetingId(url)}
    }

    return null
}

/**
 * @param {Invite} invite
 * @returns {{provider: string, url: string, id: string}|null}
 */
const getMeetLink = (invite) => {
    return invite.hangoutLink ? {provider: 'meet', url: invite.hangoutLink, id: getMeetingId(invite.hangoutLink)} : null
}

/**
 * Zoom wins over Meet: if an invite carries both, the Meet link is reported as ignored.
 *
 * @param {Invite} invite
 * @returns {{join: {provider: string, url: string, id: string}, ignoredMeet: boolean}|null}
 */
const getJoinLink = (invite) => {
    const zoom = getZoomLink(invite)
    const meet = getMeetLink(invite)

    if (zoom) return {join: zoom, ignoredMeet: meet !== null}
    if (meet) return {join: meet, ignoredMeet: false}
    return null
}

/* global module */
if (typeof module !== 'undefined') module.exports = {findZoomURL, getMeetingId, getJoinLink}
