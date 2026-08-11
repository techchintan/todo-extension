import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createTodo,
  exportTodosPayload,
  filterTodos,
  getTodos,
  nextOccurrenceAt,
  normalizeTags,
  parseImportPayload,
  requestAlarmSync,
  saveTodos,
  sortTodos,
} from "../shared/todos";
import "./popup.css";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "inbox", label: "Inbox" },
  { id: "completed", label: "Done" },
];

const PRIORITIES = [
  { value: 1, label: "P1" },
  { value: 2, label: "P2" },
  { value: 3, label: "P3" },
  { value: 4, label: "P4" },
];

function Icon({ children, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ExportIcon() {
  return (
    <Icon>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </Icon>
  );
}

function ImportIcon() {
  return (
    <Icon>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 11v6" />
      <path d="m9 14 3-3 3 3" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}

function EditIcon() {
  return (
    <Icon size={15}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  );
}

function DeleteIcon() {
  return (
    <Icon size={15}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Icon>
  );
}

function toDatetimeLocalValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelativeDue(timestamp, { kind = "due" } = {}) {
  if (!timestamp) {
    return {
      text: kind === "start" ? "No start time" : "No due date",
      tone: "muted",
    };
  }
  const now = Date.now();
  const diff = timestamp - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const label = kind === "start" ? "Starts" : "Due";
  const overdueLabel = kind === "start" ? "Start was" : "Overdue";

  if (diff < 0) {
    if (mins < 60) return { text: `${overdueLabel} · ${mins}m ago`, tone: "overdue" };
    if (hours < 48) return { text: `${overdueLabel} · ${hours}h ago`, tone: "overdue" };
    return { text: `${overdueLabel} · ${days}d ago`, tone: "overdue" };
  }
  if (mins < 60) return { text: `${label} in ${mins}m`, tone: "soon" };
  if (hours < 24) return { text: `${label} in ${hours}h`, tone: "soon" };
  if (days === 1) return { text: `${label} tomorrow`, tone: "normal" };
  return {
    text: `${label} ${new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })}`,
    tone: "normal",
  };
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const emptyForm = {
  title: "",
  description: "",
  reminderAt: "",
  url: "",
  priority: 4,
  tags: "",
  recurrence: "none",
};

const App = () => {
  const [todos, setTodos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [status, setStatus] = useState("");
  const [screen, setScreen] = useState("list");
  const [query, setQuery] = useState("");
  const importRef = useRef(null);

  const viewCounts = useMemo(() => {
    const counts = {};
    VIEWS.forEach((item) => {
      counts[item.id] = filterTodos(todos, item.id, { query }).length;
    });
    return counts;
  }, [todos, query]);
  const visibleTodos = useMemo(
    () => sortTodos(filterTodos(todos, view, { query })),
    [todos, view, query]
  );
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    []
  );

  const loadTodos = async () => {
    const items = await getTodos();
    setTodos(sortTodos(items));
    setLoading(false);
  };

  useEffect(() => {
    loadTodos();

    const onStorageChanged = (changes, area) => {
      if (
        (area === "local" || area === "sync") &&
        changes.todos
      ) {
        setTodos(sortTodos(changes.todos.newValue || []));
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, []);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const persist = async (nextTodos) => {
    const stamped = nextTodos.map((todo) => ({
      ...todo,
      updatedAt: todo.updatedAt || Date.now(),
    }));
    const sorted = await saveTodos(stamped);
    setTodos(sorted);
    await requestAlarmSync();
  };

  const closeForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setStatus("");
    setScreen("list");
  };

  const openAddForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setStatus("");
    setScreen("form");
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setForm({
      title: todo.title,
      description: todo.description || "",
      reminderAt: toDatetimeLocalValue(todo.dueAt || todo.startAt),
      url: todo.url || "",
      priority: todo.priority || 4,
      tags: (todo.tags || []).join(", "),
      recurrence: todo.recurrence || "none",
    });
    setError("");
    setStatus("");
    setScreen("form");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const reminderMs = form.reminderAt
      ? new Date(form.reminderAt).getTime()
      : null;

    if (!title) {
      setError("Title is required.");
      return;
    }
    if (form.reminderAt && Number.isNaN(reminderMs)) {
      setError("Reminder date and time are invalid.");
      return;
    }

    if (editingId) {
      const next = todos.map((todo) => {
        if (todo.id !== editingId) return todo;
        const reminderChanged = todo.dueAt !== reminderMs;
        return {
          ...todo,
          title,
          description: form.description.trim(),
          startAt: null,
          dueAt: reminderMs,
          url: form.url.trim(),
          priority: form.priority,
          tags: normalizeTags(form.tags),
          recurrence: form.recurrence,
          notified: reminderChanged ? false : todo.notified,
          startNotified: true,
          updatedAt: Date.now(),
        };
      });
      await persist(next);
    } else {
      const todo = createTodo({
        title,
        description: form.description,
        dueAt: reminderMs,
        url: form.url,
        priority: form.priority,
        tags: form.tags,
        recurrence: form.recurrence,
      });
      await persist([...todos, todo]);
    }

    const wasEditing = Boolean(editingId);
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setScreen("list");
    setStatus(wasEditing ? "Todo updated." : "Todo saved.");
  };

  const addCurrentPage = async () => {
    setStatus("");
    setError("");
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url || tab.url.startsWith("chrome://")) {
        setStatus("This page can’t be saved as a todo.");
        return;
      }
      const todo = createTodo({
        title: (tab.title || "Untitled page").slice(0, 120),
        url: tab.url,
      });
      await persist([...todos, todo]);
      setView("inbox");
      setStatus("Page added to Inbox.");
    } catch {
      setStatus("Could not read the current tab.");
    }
  };

  const toggleComplete = async (id) => {
    const next = todos.map((todo) => {
      if (todo.id !== id) return todo;
      if (!todo.completed && todo.recurrence && todo.recurrence !== "none") {
        return {
          ...todo,
          completed: false,
          notified: false,
          startNotified: false,
          dueAt: nextOccurrenceAt(todo.dueAt || Date.now(), todo.recurrence),
          startAt:
            todo.startAt != null
              ? nextOccurrenceAt(todo.startAt, todo.recurrence)
              : null,
          updatedAt: Date.now(),
        };
      }
      const completed = !todo.completed;
      return {
        ...todo,
        completed,
        notified: completed ? true : todo.notified,
        startNotified: completed ? true : todo.startNotified,
        updatedAt: Date.now(),
      };
    });
    await persist(next);
  };

  const removeTodo = async (id) => {
    await persist(todos.filter((todo) => todo.id !== id));
    if (editingId === id) {
      closeForm();
    }
  };

  const clearCompleted = async () => {
    await persist(todos.filter((todo) => !todo.completed));
    setStatus("Cleared completed todos.");
  };

  const exportTodos = () => {
    const payload = exportTodosPayload(todos);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `todo-reminder-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Exported backup.");
  };

  const importTodos = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseImportPayload(text);
      const mergedMap = new Map(todos.map((todo) => [todo.id, todo]));
      imported.forEach((todo) => mergedMap.set(todo.id, todo));
      await persist([...mergedMap.values()]);
      setStatus(`Imported ${imported.length} todos.`);
    } catch {
      setError("Could not import that file.");
    }
  };

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="app">
      <header className="header">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">{todayLabel}</p>
            <h1>Todo Reminder</h1>
          </div>
          {screen === "list" ? (
            <div className="header-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={exportTodos}
                title="Export"
                aria-label="Export"
              >
                <ExportIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => importRef.current?.click()}
                title="Import"
                aria-label="Import"
              >
                <ImportIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => chrome.runtime.openOptionsPage()}
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon />
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={importTodos}
              />
            </div>
          ) : null}
        </div>
      </header>

      {status && screen === "list" ? <p className="status banner">{status}</p> : null}

      {screen === "list" ? (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search todos, tags, links…"
              aria-label="Search todos"
            />
          </div>

          <div className="view-tabs" role="tablist" aria-label="Todo views">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={`view-tab${view === item.id ? " active" : ""}`}
                onClick={() => setView(item.id)}
              >
                <span>{item.label}</span>
                <span className="view-count">{viewCounts[item.id] || 0}</span>
              </button>
            ))}
          </div>

          <section className="list-section">
            {view === "completed" && completedCount > 0 ? (
              <div className="list-head">
                <button
                  type="button"
                  className="text-btn"
                  onClick={clearCompleted}
                >
                  Clear all
                </button>
              </div>
            ) : null}

            {loading ? <p className="muted">Loading…</p> : null}
            {!loading && visibleTodos.length === 0 ? (
              <div className="empty-card">
                <p className="empty-title">Nothing here yet</p>
                <p className="empty">
                  {query
                    ? "No matches for this search."
                    : "Tap New todo to create your first task."}
                </p>
              </div>
            ) : null}

            <ul className="todo-list">
              {visibleTodos.map((todo) => {
                const due = formatRelativeDue(todo.dueAt, { kind: "due" });
                const start = formatRelativeDue(todo.startAt, { kind: "start" });
                const priority = todo.priority || 4;
                return (
                  <li
                    key={todo.id}
                    className={`todo-item p${priority}${
                      todo.completed ? " completed" : ""
                    }`}
                  >
                    <div className="todo-main">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() => toggleComplete(todo.id)}
                        />
                        <span className="todo-title">{todo.title}</span>
                      </label>
                      {todo.description ? (
                        <p className="todo-desc">{todo.description}</p>
                      ) : null}
                      <div className="meta-row">
                        <span className={`priority-tag p${priority}`}>
                          P{priority}
                        </span>
                        {todo.startAt ? (
                          <span className={`due-tag ${start.tone}`}>
                            {start.text}
                          </span>
                        ) : null}
                        {todo.dueAt ? (
                          <span className={`due-tag ${due.tone}`}>{due.text}</span>
                        ) : !todo.startAt ? (
                          <span className={`due-tag ${due.tone}`}>{due.text}</span>
                        ) : null}
                        {todo.recurrence && todo.recurrence !== "none" ? (
                          <span className="due-tag">{todo.recurrence}</span>
                        ) : null}
                        {(todo.tags || []).map((tag) => (
                          <span key={tag} className="tag-mini">
                            #{tag}
                          </span>
                        ))}
                        {todo.url ? (
                          <a
                            className="todo-link"
                            href={todo.url}
                            target="_blank"
                            rel="noreferrer"
                            title={todo.url}
                          >
                            {hostnameFromUrl(todo.url)}
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="todo-actions">
                      <button
                        type="button"
                        className="icon-btn edit"
                        onClick={() => startEdit(todo)}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removeTodo(todo.id)}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="list-footer">
            <button
              type="button"
              className="btn outline"
              onClick={addCurrentPage}
            >
              Save page
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={openAddForm}
            >
              New todo
            </button>
          </div>
        </>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <h2 className="form-title">
            {editingId ? "Edit todo" : "New todo"}
          </h2>

          <label>
            Title
            <input
              className="quick-input"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs doing?"
              maxLength={120}
              autoFocus
            />
          </label>

          <div className="priority-row" role="group" aria-label="Priority">
            {PRIORITIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`priority p${item.value}${
                  form.priority === item.value ? " active" : ""
                }`}
                onClick={() => setForm({ ...form, priority: item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="details">
            <label>
              Notes
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional notes"
                rows={2}
                maxLength={300}
              />
            </label>

            <label>
              Tags
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="work, personal"
              />
            </label>

            <label>
              Repeat
              <select
                value={form.recurrence}
                onChange={(e) =>
                  setForm({ ...form, recurrence: e.target.value })
                }
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>

            <label>
              Reminder
              <input
                type="datetime-local"
                value={form.reminderAt}
                onChange={(e) =>
                  setForm({ ...form, reminderAt: e.target.value })
                }
              />
            </label>
            <p className="hint">Optional — get a notification at this time.</p>

            {editingId ? (
              <label>
                Link
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://"
                />
              </label>
            ) : null}
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="form-actions row">
            <button
              type="button"
              className="btn outline"
              onClick={closeForm}
            >
              Close
            </button>
            <button type="submit" className="btn primary">
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
