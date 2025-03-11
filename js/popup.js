const button = document.getElementById('powerButton');
const checkBox = document.getElementById('mode-switch');
const checkBoxAuto = document.getElementById('mode-switch-auto');
const style = document.getElementById('theme-style');

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

// Checkbox and page style controllers

const syncThemes = () => {
    chrome.storage.local.get(["extensionThemeSettings"]).then(
        (result) => {
            checkBoxAuto.checked = result.extensionThemeSettings.mode === 'auto'

            checkBox.disabled = result.extensionThemeSettings.mode === 'auto'
            checkBox.checked = result.extensionThemeSettings.theme === 'dark'

            style.href = (result.extensionThemeSettings.theme === 'dark') ? 'css/dark-mode.css' : 'css/pink-mode.css'
        }
    )
}

const setThemeMode = (theme, mode) => {
    chrome.storage.local.get(["extensionThemeSettings"]).then(
        (result) => {
            if (result.extensionThemeSettings !== undefined) {
                let new_settings = {
                    theme: (theme !== undefined) ? theme : (result.extensionThemeSettings.theme !== undefined) ? result.extensionThemeSettings.theme : 'pink',
                    mode: (mode !== undefined) ? mode : (result.extensionThemeSettings.mode !== undefined) ? result.extensionThemeSettings.mode : 'manual'
                }
                chrome.storage.local.set({ extensionThemeSettings: new_settings }).then(() => syncThemes())
            } else {
                let default_settings = {theme: theme ? theme : 'pink', mode: mode ? mode: 'manual'}
                chrome.storage.local.set({ extensionThemeSettings: default_settings }).then(() => syncThemes())
            }
        }
    )
}

checkBox.addEventListener('change', function() {
    setThemeMode(this.checked ? 'dark' : 'pink', undefined)
});

checkBoxAuto.addEventListener('change', function() {
    if (this.checked) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setThemeMode('dark', 'auto')
        } else {
            setThemeMode('pink', 'auto')
        }
    } else {
        setThemeMode(undefined, 'manual')
    }
});

const initTheme = () => {
    chrome.storage.local.get(["extensionThemeSettings"]).then((result) => {
        if (result.extensionThemeSettings === undefined) {
            // By default, use default settings
            setThemeMode(undefined, undefined)
        } else {
            if (result.extensionThemeSettings.mode !== undefined) {
                // Sync theme if Chrome auto mode is set
                syncThemes()
            } else {
                if (result.extensionThemeSettings.theme !== undefined) {
                    // Sync theme if theme is set
                    syncThemes()
                } else {
                    setThemeMode(undefined, undefined)
                }
            }
        }
    })
}

initTheme()

const timeJoin = document.getElementById('time-join');
const timeJoinValue = document.getElementById('time-join-value');

timeJoin.addEventListener('input', function(){
    chrome.storage.local.set({ extensionSettingsTime: { "interval": this.value } }).then(() => syncRangeText())
});

const syncRangeText = () => {
    chrome.storage.local.get(["extensionSettingsTime"]).then(
        (result) => {
            if (result.extensionSettingsTime !== undefined)
                timeJoin.value = result.extensionSettingsTime.interval
            else
                timeJoin.value = -2

            timeJoinValue.innerText = timeJoin.value
        }
    )
}

syncRangeText()

const getCurrentDate = () => {
    d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    document.getElementById('today-date').innerText =  `${new Date().toLocaleDateString().toLocaleString()} CW${weekNo}`
}

getCurrentDate()

const dropdown = document.getElementById('meetDropdown');
const header = document.getElementById('dropdownHeader');
const panel = document.getElementById('dropdownPanel');
const checkboxes = panel.querySelectorAll('input[type="checkbox"]');

header.addEventListener('click', function () {
    dropdown.classList.toggle('open');
});

const setMeetJoinFlags = (flags) => {
    checkboxes.forEach(chk => {
        chk.checked = flags.includes(chk.value)
    })
    header.textContent = `Select Meeting Types [${flags.length} selected]`
}

const syncMeetJoinFlags = () => {
    chrome.storage.local.get(["extensionSettingsMeetJoinFlags"]).then(
        (result) => {
            setMeetJoinFlags(
                result.extensionSettingsMeetJoinFlags !== undefined && result.extensionSettingsMeetJoinFlags.flags !== undefined ?
                    result.extensionSettingsMeetJoinFlags.flags : ['confirmed']
            )
        }
    )
}

checkboxes.forEach(chk => {
    chk.addEventListener('change', () => {
        const selected = Array.from(checkboxes).filter(chk => chk.checked);
        const selectedFlags = selected.map(chk => chk.value);
        chrome.storage.local.set({ extensionSettingsMeetJoinFlags: { "flags": selectedFlags.length > 0 ? selectedFlags : ['confirmed'] } }).then(() => {syncMeetJoinFlags()})
    });
});

document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) {
        dropdown.classList.remove('open');
    }
});

syncMeetJoinFlags()
