import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings, saveSettings } from "../shared/todos";
import "./options.css";

const App = () => {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setSyncEnabled(Boolean(settings.syncEnabled));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async (enabled) => {
    setSyncEnabled(enabled);
    setStatus("");
    try {
      await saveSettings({ syncEnabled: enabled });
      setStatus(
        enabled
          ? "Chrome sync on — todos sync with your Google account (size limits apply)."
          : "Chrome sync off — todos stay on this device only."
      );
    } catch {
      setStatus("Could not save settings.");
    }
  };

  return (
    <div className="options">
      <header>
        <img src="icon.png" alt="" width="40" height="40" />
        <div>
          <h1>Todo Reminder settings</h1>
          <p>Reminders, sync, save pages, and shortcuts.</p>
        </div>
      </header>

      {loading ? <p className="muted">Loading…</p> : null}

      <section className="card">
        <h2>Chrome sync</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => save(e.target.checked)}
          />
          <span>Sync todos across my Chrome browsers</span>
        </label>
        <p className="hint">
          Uses <code>chrome.storage.sync</code> with your Google account. Large
          lists may hit Chrome’s sync size limit — use Export / Import in the
          popup as a backup.
        </p>
        {status ? <p className="status">{status}</p> : null}
      </section>

      <section className="card">
        <h2>Reminders</h2>
        <p>
          Each todo can have one optional <strong>Reminder</strong> time. At
          that time Chrome shows a notification for the task.
        </p>
        <ul className="list">
          <li>
            <strong>One-time</strong> todos are marked Done automatically when
            the reminder fires.
          </li>
          <li>
            <strong>Daily / Weekly</strong> todos stay open. The notification
            includes a <strong>Complete</strong> button (where Chrome supports
            it) to advance to the next occurrence.
          </li>
        </ul>
        <p className="hint">
          Click a notification to open the extension popup.
        </p>
      </section>

      <section className="card">
        <h2>Save from the web</h2>
        <ul className="list">
          <li>
            Use <strong>Save page</strong> in the popup to add the current tab
            to Inbox.
          </li>
          <li>
            Right-click a page → <strong>Add page as todo</strong>.
          </li>
          <li>
            Select text → right-click → <strong>Add selection as todo</strong>.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Organize in the popup</h2>
        <ul className="list">
          <li>
            Views: <strong>All</strong>, <strong>Today</strong>,{" "}
            <strong>Upcoming</strong>, <strong>Inbox</strong>,{" "}
            <strong>Done</strong>
          </li>
          <li>Priorities P1–P4, tags, notes, and search</li>
          <li>Repeat: none, daily, or weekly</li>
        </ul>
      </section>

      <section className="card">
        <h2>Keyboard shortcut</h2>
        <p>
          Default: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> opens the
          Todo Reminder popup.
        </p>
        <p className="hint">
          Change it in <code>chrome://extensions/shortcuts</code>.
        </p>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p>
          Use the Export and Import icons in the popup header to download or
          restore a JSON backup of your todos.
        </p>
        <p className="hint">
          Recommended before turning sync on, or when moving to another
          computer.
        </p>
      </section>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
