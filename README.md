# Todo Reminder Chrome Extension

Chrome extension for managing a todo list with system notifications when a due date and time arrives — inspired by [Todoist for Chrome](https://chromewebstore.google.com/detail/todoist-for-chrome-planne/jldhpllghnbhlbpcmnajkpdmadaolakh) quick-add and web clipping habits.

## Features

- Quick-add todos from the popup
- Add the current website as a todo (popup button or right-click menu)
- Add selected text as a hyperlinked todo (right-click selection or page quick-add)
- Floating quick-add on web pages
- Day planning views: All, Today, Upcoming, Inbox, Done
- Optional due dates — Inbox items have no reminder until you schedule them
- Chrome notifications when a scheduled todo is due
- Mark todos complete without leaving the browser

## Getting Started

1. `npm i` to install dependencies
2. `npm start` for a watch build into `dist`, or `npm run build` for production
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the `dist` folder

## Web clipping

- **Popup:** open the extension → **Add this page**
- **Right-click page:** **Add page as todo**
- **Right-click selection:** **Add selection as todo**
- **On-page FAB:** click **+** → Save page or Save selection

Saved pages/selections land in **Inbox** (no due date). Edit them later to set a reminder.

## Notifications when Chrome windows are closed

Chrome extensions cannot run after Chrome is **fully quit**.

They **can** still fire alarms and notifications if Chrome keeps running in the background with no windows open.

On Windows:

1. Open `chrome://settings/system`
2. Turn on **Continue running background apps when Google Chrome is closed**

Then close all Chrome windows and keep that setting on. Due todos should still notify.

If you end Chrome completely (Quit / End task), notifications will not fire until Chrome starts again.

## How to test a reminder

1. Add a todo with a due time about 1 minute from now
2. Optionally close all Chrome windows (with background apps enabled)
3. When the time arrives, Chrome should show a “Todo due” notification

## Notes

- Todos are stored in `chrome.storage.local`
- Reminders use `chrome.alarms` and `chrome.notifications`
- Editing a todo’s due time reschedules its alarm
