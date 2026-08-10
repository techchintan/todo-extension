# Todo Reminder Chrome Extension

Chrome extension for managing a todo list with system notifications when a due date and time arrives.

## Features

- Create, read, update, and delete todos
- Mark todos complete / incomplete
- Schedule a Chrome notification for each incomplete todo’s due time

## Getting Started

1. `npm i` to install dependencies
2. `npm start` for a watch build into `dist`, or `npm run build` for production
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the `dist` folder

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
