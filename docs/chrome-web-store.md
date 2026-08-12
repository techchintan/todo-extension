# Chrome Web Store — Todo Reminder

Use this when submitting at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Package

```bash
npm run package
```

Upload the generated zip (for example `todo-reminder-1.2.0.zip`) from the repo root. Do **not** upload the whole source repo.

## Listing

| Field | Value |
| --- | --- |
| Name | Todo Reminder |
| Category | Productivity |
| Language | English (add other locales as needed) |

### Single purpose

Help users create and manage todos and receive Chrome notifications when todos start or are due.

### Short description (≤132 characters)

```
Quick-add todos, save pages or selections, priorities and tags, and Chrome reminders when items start or are due.
```

### Detailed description

```
Todo Reminder is a lightweight todo list for Chrome with system notifications.

Features
• Quick-add from the toolbar popup (shortcut: Alt+Shift+T)
• Save the current page or selected text as a todo (popup or right-click menu)
• Views: All, Today (includes overdue), Upcoming, Inbox, Done
• Priorities (P1–P4), tags, search, and daily/weekly recurrence
• Chrome notifications when a todo starts or is due, with a Complete action
• Optional Chrome sync and Export/Import backup

Privacy
• Todos stay in Chrome storage on your device by default
• Optional sync uses Google chrome.storage.sync when you turn it on
• No analytics and no developer-operated servers

Tip for Windows: chrome://settings/system → enable “Continue running background apps when Google Chrome is closed” so reminders can fire when all windows are closed.
```

## Store assets (create manually)

| Asset | Spec |
| --- | --- |
| Store icon | Upload `src/static/icon-128.png` (128×128; larger is fine if you add one later) |
| Screenshots | At least 1 image, **1280×800** or **640×400** (PNG/JPEG). Capture the popup list, add-todo form, and options/sync page from a loaded `dist` build. |
| Small promo (optional) | 440×280 |
| Marquee (optional) | 1400×560 |

Do **not** claim an on-page floating button/FAB — that feature is not in the shipping build.

## Privacy practices (dashboard)

Host [`privacy-policy.html`](./privacy-policy.html) at a public **HTTPS** URL (for example GitHub Pages). Replace `YOUR_EMAIL@example.com` first.

Suggested disclosures (match what the extension actually does):

- **Does collect / handle:** user activity related to todos you create; website content only when you explicitly save a page title/URL or selection as a todo.
- **Does not:** sell data; use data for unrelated purposes; transfer data for purposes unrelated to the single purpose (beyond optional Google Chrome Sync when enabled).
- Certify that data is not sold and is used only to provide the extension’s features.

Remote code: none. All logic is bundled in the package.

## Permission justifications (paste into dashboard)

| Permission | Justification |
| --- | --- |
| `storage` | Store todos and settings in `chrome.storage.local`, and optionally `chrome.storage.sync` when the user enables sync. |
| `alarms` | Schedule start-time and due-time reminders for incomplete todos. |
| `notifications` | Show “Todo starting” / “Todo due” system notifications and a Complete button. |
| `contextMenus` | Provide “Add page as todo” and “Add selection as todo” on right-click. |
| `activeTab` | Read the active tab’s title and URL only when the user invokes the extension (for example Save current page in the popup). |

No host permissions are requested.

## Publish checklist

1. Create / pay for a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) ($5 one-time).
2. Replace the contact email in `docs/privacy-policy.html` and host it on HTTPS.
3. Run `npm run package` and confirm the zip loads via **Load unpacked** → extract and test core flows (add todo, save page, context menu, notification Complete, options sync toggle).
4. Dashboard → **New item** → upload the zip.
5. Fill listing fields from this doc; upload screenshots and store icon.
6. Complete **Privacy practices**: justifications, data disclosures, privacy policy URL.
7. Set distribution (public / unlisted) and submit for review.
8. After approval, run `npm run package` again for updates (it bumps the patch version, then rebuilds the zip).
