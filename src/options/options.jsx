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
          <p>Sync, shortcuts, and backup tips.</p>
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
          lists may hit Chrome’s sync size limit — use Export/Import in the
          popup as a backup.
        </p>
        {status ? <p className="status">{status}</p> : null}
      </section>

      <section className="card">
        <h2>Keyboard shortcut</h2>
        <p>
          Default: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> opens quick
          add.
        </p>
        <p className="hint">
          Change it in <code>chrome://extensions/shortcuts</code>.
        </p>
      </section>

      <section className="card">
        <h2>Notifications</h2>
        <p>
          You get a <strong>Todo starting</strong> alert at start time and a{" "}
          <strong>Todo due</strong> alert at due time. Both can include a{" "}
          <strong>Complete</strong> action where Chrome supports notification
          buttons.
        </p>
      </section>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
