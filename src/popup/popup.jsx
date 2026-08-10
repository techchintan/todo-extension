import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createTodo,
  filterTodos,
  getTodos,
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

function toDatetimeLocalValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDue(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  dueAt: "",
  url: "",
};

const App = () => {
  const [todos, setTodos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [status, setStatus] = useState("");

  const visibleTodos = useMemo(
    () => sortTodos(filterTodos(todos, view)),
    [todos, view]
  );

  const loadTodos = async () => {
    const items = await getTodos();
    setTodos(sortTodos(items));
    setLoading(false);
  };

  useEffect(() => {
    loadTodos();

    const onStorageChanged = (changes, area) => {
      if (area === "local" && changes.todos) {
        setTodos(sortTodos(changes.todos.newValue || []));
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, []);

  const persist = async (nextTodos) => {
    const sorted = sortTodos(nextTodos);
    setTodos(sorted);
    await saveTodos(sorted);
    await requestAlarmSync();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setForm({
      title: todo.title,
      description: todo.description || "",
      dueAt: toDatetimeLocalValue(todo.dueAt),
      url: todo.url || "",
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const dueMs = form.dueAt ? new Date(form.dueAt).getTime() : null;

    if (!title) {
      setError("Title is required.");
      return;
    }
    if (form.dueAt && Number.isNaN(dueMs)) {
      setError("Due date and time are invalid.");
      return;
    }

    if (editingId) {
      const next = todos.map((todo) => {
        if (todo.id !== editingId) return todo;
        const dueChanged = todo.dueAt !== dueMs;
        return {
          ...todo,
          title,
          description: form.description.trim(),
          dueAt: dueMs,
          url: form.url.trim(),
          notified: dueChanged ? false : todo.notified,
        };
      });
      await persist(next);
    } else {
      const todo = createTodo({
        title,
        description: form.description,
        dueAt: dueMs,
        url: form.url,
      });
      await persist([...todos, todo]);
    }

    resetForm();
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
        setError("This page can’t be saved as a todo.");
        return;
      }
      const todo = createTodo({
        title: (tab.title || "Untitled page").slice(0, 120),
        url: tab.url,
      });
      await persist([...todos, todo]);
      setStatus("Page added to Inbox.");
      setView("inbox");
    } catch {
      setError("Could not read the current tab.");
    }
  };

  const toggleComplete = async (id) => {
    const next = todos.map((todo) => {
      if (todo.id !== id) return todo;
      const completed = !todo.completed;
      return {
        ...todo,
        completed,
        notified: completed ? true : todo.notified,
      };
    });
    await persist(next);
  };

  const removeTodo = async (id) => {
    await persist(todos.filter((todo) => todo.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Todo Reminder</h1>
        <p>Quick-add tasks, save pages, and get notified when due.</p>
      </header>

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
            {item.label}
          </button>
        ))}
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Quick add
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs doing?"
            maxLength={120}
            autoFocus
          />
        </label>

        <label>
          Notes
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional notes"
            rows={2}
            maxLength={300}
          />
        </label>

        <label>
          Due date & time
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
          />
        </label>
        <p className="hint">Optional — leave blank for Inbox (no reminder).</p>

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

        {error ? <p className="error">{error}</p> : null}
        {status ? <p className="status">{status}</p> : null}

        <div className="form-actions">
          <button type="submit" className="btn primary">
            {editingId ? "Save changes" : "Add todo"}
          </button>
          {!editingId ? (
            <button type="button" className="btn" onClick={addCurrentPage}>
              Add this page
            </button>
          ) : (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="list-section">
        <h2>
          {VIEWS.find((item) => item.id === view)?.label || "Todos"}
          {!loading ? (
            <span className="count"> ({visibleTodos.length})</span>
          ) : null}
        </h2>
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && visibleTodos.length === 0 ? (
          <p className="empty">
            {view === "today"
              ? "Nothing due today."
              : view === "inbox"
                ? "Inbox is empty. Save a page or add a todo without a due date."
                : "No todos in this view."}
          </p>
        ) : null}
        <ul className="todo-list">
          {visibleTodos.map((todo) => (
            <li
              key={todo.id}
              className={`todo-item${todo.completed ? " completed" : ""}`}
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
                <p className="todo-due">
                  {todo.dueAt
                    ? `Due ${formatDue(todo.dueAt)}${
                        todo.notified && !todo.completed ? " · notified" : ""
                      }`
                    : "No due date"}
                </p>
              </div>
              <div className="todo-actions">
                <button
                  type="button"
                  className="btn small"
                  onClick={() => startEdit(todo)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => removeTodo(todo.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
