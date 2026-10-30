// Run: node --test tests/
const test = require('node:test')
const assert = require('node:assert')
const {findZoomURL, getMeetingId, getJoinLink} = require('../js/join-links.js')

const ZOOM = 'https://us02web.zoom.us/j/81234567890?pwd=AbC123'

test('Meet only', () => {
    const r = getJoinLink({hangoutLink: 'https://meet.google.com/abc-defg-hij'})
    assert.deepStrictEqual(r, {join: {provider: 'meet', url: 'https://meet.google.com/abc-defg-hij', id: 'abc-defg-hij'}, ignoredMeet: false})
})

test('Zoom from add-on conferenceData', () => {
    const r = getJoinLink({conferenceData: {entryPoints: [{entryPointType: 'video', uri: ZOOM}]}})
    assert.strictEqual(r.join.url, ZOOM)
    assert.strictEqual(r.join.id, '81234567890')
    assert.strictEqual(r.ignoredMeet, false)
})

test('Zoom from location', () => {
    assert.strictEqual(getJoinLink({location: ZOOM}).join.provider, 'zoom')
})

test('Zoom from HTML description, entities decoded', () => {
    const r = getJoinLink({description: '<a href="https://zoom.us/j/81234567890?pwd=x&amp;from=addon">join</a>'})
    assert.strictEqual(r.join.url, 'https://zoom.us/j/81234567890?pwd=x&from=addon')
})

test('Zoom in plain text, trailing punctuation dropped', () => {
    assert.strictEqual(findZoomURL(`Join at ${ZOOM}.`), ZOOM)
})

test('Vanity link', () => {
    assert.strictEqual(getJoinLink({location: 'https://company.zoom.us/my/john.doe'}).join.id, 'john.doe')
})

test('Zoom and Meet together: Zoom wins, Meet reported as ignored', () => {
    const r = getJoinLink({hangoutLink: 'https://meet.google.com/abc-defg-hij', location: ZOOM})
    assert.strictEqual(r.join.provider, 'zoom')
    assert.strictEqual(r.ignoredMeet, true)
})

test('Recording and unrelated links are not joinable', () => {
    assert.strictEqual(getJoinLink({description: 'https://zoom.us/rec/share/abc https://example.com'}), null)
})

test('No link', () => assert.strictEqual(getJoinLink({summary: 'Lunch'}), null))

test('Meeting id survives URL rewriting', () => {
    assert.strictEqual(getMeetingId('https://zoom.us/wc/join/81234567890'), '81234567890')
    assert.strictEqual(getMeetingId('https://meet.google.com/_meet/abc-defg-hij?authuser=0'), 'abc-defg-hij')
})
