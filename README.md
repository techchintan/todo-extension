# Todo Reminder Chrome Extension

Chrome extension for managing a todo list with system notifications when a due date and time arrives — inspired by [Todoist for Chrome](https://chromewebstore.google.com/detail/todoist-for-chrome-planne/jldhpllghnbhlbpcmnajkpdmadaolakh) quick-add and web clipping habits.

## Features

- Quick-add todos from the popup (`Alt+Shift+T`)
- Add the current website / selected text as a todo
- Views: All, Today (includes overdue), Upcoming, Inbox, Done
- Priorities (P1–P4), tags, search, and recurring daily/weekly todos
- Complete action on due notifications
- Optional Chrome sync + Export/Import backup
- Chrome notifications when a todo **starts** (“Todo starting”) or is **due** (“Todo due”)
- Completing a recurring todo advances start and due to the next occurrence

## Getting Started

1. `npm i` to install dependencies
2. `npm start` for a watch build into `dist`, or `npm run build` for production
3. Open Chrome → `chrome://extensions/` → Developer mode → **Load unpacked** → `dist`
4. After updates, click **Reload** on the extension card
5. Optional: enable sync in **Settings**, or change the shortcut at `chrome://extensions/shortcuts`

## Chrome Web Store

1. Replace the contact email in [`docs/privacy-policy.html`](docs/privacy-policy.html) and host that file on a public HTTPS URL
2. `npm run package` — bumps the patch version, production build, then `todo-reminder-<version>.zip` at the repo root
3. Upload the zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Follow the listing copy, privacy answers, and checklist in [`docs/chrome-web-store.md`](docs/chrome-web-store.md)

Use `npm run bump` alone if you only need to bump version without packaging.

## Web clipping

- **Popup:** **Save current page**
- **Right-click page:** **Add page as todo**
- **Right-click selection:** **Add selection as todo**

## Notifications when Chrome windows are closed

On Windows: `chrome://settings/system` → turn on **Continue running background apps when Google Chrome is closed**.

## Notes

- Todos are stored in `chrome.storage.local` (and optionally `chrome.storage.sync`)
- Reminders use `chrome.alarms` and `chrome.notifications`
- Completing a recurring todo advances it to the next occurrence
