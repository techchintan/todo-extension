import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./contentScript.css";

const App = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(document.title || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const close = () => {
    setOpen(false);
    setMessage("");
  };

  const addPage = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim() || document.title || "Untitled page";
    setBusy(true);
    setMessage("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ADD_TODO",
        payload: {
          title: nextTitle.slice(0, 120),
          url: window.location.href,
          description: "",
        },
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Failed");
      }
      setMessage("Saved to Inbox");
      setTimeout(close, 900);
    } catch {
      setMessage("Could not save todo");
    } finally {
      setBusy(false);
    }
  };

  const addSelection = async () => {
    const selected = window.getSelection()?.toString().trim() || "";
    if (!selected) {
      setMessage("Select text on the page first");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ADD_TODO",
        payload: {
          title: selected.slice(0, 120),
          description: `From: ${document.title || "page"}`,
          url: window.location.href,
        },
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Failed");
      }
      setMessage("Selection saved");
      setTimeout(close, 900);
    } catch {
      setMessage("Could not save selection");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tr-root">
      {!open ? (
        <button
          type="button"
          className="tr-fab"
          title="Quick add todo"
          aria-label="Quick add todo"
          onClick={() => {
            setTitle(document.title || "");
            setOpen(true);
          }}
        >
          +
        </button>
      ) : (
        <form className="tr-panel" onSubmit={addPage}>
          <div className="tr-header">
            <span className="tr-title">Quick add</span>
            <button
              type="button"
              className="tr-close"
              aria-label="Close"
              onClick={close}
            >
              ×
            </button>
          </div>
          <label className="tr-label">
            Task
            <input
              className="tr-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
          </label>
          <p className="tr-url" title={window.location.href}>
            {window.location.hostname}
          </p>
          {message ? <p className="tr-message">{message}</p> : null}
          <div className="tr-actions">
            <button type="submit" className="tr-btn primary" disabled={busy}>
              Save page
            </button>
            <button
              type="button"
              className="tr-btn"
              disabled={busy}
              onClick={addSelection}
            >
              Save selection
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const host = document.createElement("div");
host.id = "todo-reminder-root";
document.documentElement.appendChild(host);
const root = createRoot(host);
root.render(<App />);
