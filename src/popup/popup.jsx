import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  collectTags,
  createTodo,
  exportTodosPayload,
  filterTodos,
  getTodoStats,
  getTodos,
  nextOccurrenceAt,
  normalizeTags,
  parseImportPayload,
  requestAlarmSync,
  requestBadgeSync,
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

function toDatetimeLocalValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function atLocalTime(baseDate, hours, minutes = 0) {
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function quickDueValue(kind) {
  const now = new Date();
  if (kind === "today") return atLocalTime(now, 18, 0);
  if (kind === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return atLocalTime(tomorrow, 9, 0);
  }
  if (kind === "weekend") {
    const next = new Date(now);
    const day = next.getDay();
    const daysUntilSat = (6 - day + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilSat);
    return atLocalTime(next, 10, 0);
  }
  return null;
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
  startAt: "",
  dueAt: "",
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
  const [showDetails, setShowDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const importRef = useRef(null);

  const stats = useMemo(() => getTodoStats(todos), [todos]);
  const tags = useMemo(() => collectTags(todos), [todos]);
  const visibleTodos = useMemo(
    () =>
      sortTodos(
        filterTodos(todos, view, { query, tag: tagFilter })
      ),
    [todos, view, query, tagFilter]
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
    await requestBadgeSync();
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

  const persist = async (nextTodos) => {
    const stamped = nextTodos.map((todo) => ({
      ...todo,
      updatedAt: todo.updatedAt || Date.now(),
    }));
    const sorted = await saveTodos(stamped);
    setTodos(sorted);
    await requestAlarmSync();
    await requestBadgeSync();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowDetails(false);
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setForm({
      title: todo.title,
      description: todo.description || "",
      startAt: toDatetimeLocalValue(todo.startAt),
      dueAt: toDatetimeLocalValue(todo.dueAt),
      url: todo.url || "",
      priority: todo.priority || 4,
      tags: (todo.tags || []).join(", "),
      recurrence: todo.recurrence || "none",
    });
    setShowDetails(true);
    setError("");
  };

  const applyQuickDue = (kind) => {
    const ms = quickDueValue(kind);
    if (!ms) {
      setForm({ ...form, dueAt: "" });
      return;
    }
    setForm({ ...form, dueAt: toDatetimeLocalValue(ms) });
    setShowDetails(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const startMs = form.startAt ? new Date(form.startAt).getTime() : null;
    const dueMs = form.dueAt ? new Date(form.dueAt).getTime() : null;

    if (!title) {
      setError("Title is required.");
      return;
    }
    if (form.startAt && Number.isNaN(startMs)) {
      setError("Start date and time are invalid.");
      return;
    }
    if (form.dueAt && Number.isNaN(dueMs)) {
      setError("Due date and time are invalid.");
      return;
    }
    if (startMs != null && dueMs != null && startMs > dueMs) {
      setError("Start time must be before due time.");
      return;
    }

    if (editingId) {
      const next = todos.map((todo) => {
        if (todo.id !== editingId) return todo;
        const dueChanged = todo.dueAt !== dueMs;
        const startChanged = todo.startAt !== startMs;
        return {
          ...todo,
          title,
          description: form.description.trim(),
          startAt: startMs,
          dueAt: dueMs,
          url: form.url.trim(),
          priority: form.priority,
          tags: normalizeTags(form.tags),
          recurrence: form.recurrence,
          notified: dueChanged ? false : todo.notified,
          startNotified: startChanged ? false : todo.startNotified,
          updatedAt: Date.now(),
        };
      });
      await persist(next);
    } else {
      const todo = createTodo({
        title,
        description: form.description,
        startAt: startMs,
        dueAt: dueMs,
        url: form.url,
        priority: form.priority,
        tags: form.tags,
        recurrence: form.recurrence,
      });
      await persist([...todos, todo]);
    }

    resetForm();
    setStatus(editingId ? "Todo updated." : "Todo added.");
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
        priority: form.priority,
        tags: form.tags,
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
      resetForm();
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
          <div className="header-actions">
            <button type="button" className="icon-btn" onClick={exportTodos} title="Export">
              Export
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => importRef.current?.click()}
              title="Import"
            >
              Import
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => chrome.runtime.openOptionsPage()}
              title="Settings"
            >
              Settings
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={importTodos}
            />
          </div>
        </div>
        <div className="stats" aria-label="Todo summary">
          <div className="stat">
            <span className="stat-value">{stats.open}</span>
            <span className="stat-label">Open</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.today}</span>
            <span className="stat-label">Today</span>
          </div>
          <div className={`stat${stats.overdue ? " alert" : ""}`}>
            <span className="stat-value">{stats.overdue}</span>
            <span className="stat-label">Overdue</span>
          </div>
        </div>
      </header>

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
            {item.label}
          </button>
        ))}
      </div>

      {tags.length ? (
        <div className="tag-row" aria-label="Filter by tag">
          <button
            type="button"
            className={`tag-chip${!tagFilter ? " active" : ""}`}
            onClick={() => setTagFilter("")}
          >
            All tags
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-chip${tagFilter === tag ? " active" : ""}`}
              onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      <form className="form" onSubmit={handleSubmit}>
        <div className="quick-row">
          <input
            className="quick-input"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={editingId ? "Edit todo…" : "Quick add a task…"}
            maxLength={120}
            autoFocus
            aria-label="Todo title"
          />
          <button type="submit" className="btn primary">
            {editingId ? "Save" : "Add"}
          </button>
        </div>

        <div className="chip-row" aria-label="Quick schedule">
          <button type="button" className="chip" onClick={() => applyQuickDue("today")}>
            Today 6pm
          </button>
          <button type="button" className="chip" onClick={() => applyQuickDue("tomorrow")}>
            Tomorrow
          </button>
          <button type="button" className="chip" onClick={() => applyQuickDue("weekend")}>
            Weekend
          </button>
          <button type="button" className="chip" onClick={() => applyQuickDue("clear")}>
            No date
          </button>
        </div>

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
          <button
            type="button"
            className="details-toggle"
            onClick={() => setShowDetails((open) => !open)}
          >
            {showDetails ? "Hide details" : "More details"}
          </button>
        </div>

        {showDetails ? (
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
              Start date & time
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </label>
            <p className="hint">Optional — notifies when the todo should start.</p>

            <label>
              Due date & time
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </label>
            <p className="hint">Optional — notifies when the todo is due.</p>

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
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {status ? <p className="status">{status}</p> : null}

        <div className="form-actions">
          {!editingId ? (
            <button type="button" className="btn ghost" onClick={addCurrentPage}>
              Save current page
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <section className="list-section">
        <div className="list-head">
          <h2>
            {VIEWS.find((item) => item.id === view)?.label || "Todos"}
            {!loading ? (
              <span className="count"> {visibleTodos.length}</span>
            ) : null}
          </h2>
          {view === "completed" && completedCount > 0 ? (
            <button type="button" className="text-btn" onClick={clearCompleted}>
              Clear all
            </button>
          ) : null}
        </div>

        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && visibleTodos.length === 0 ? (
          <div className="empty-card">
            <p className="empty-title">Nothing here yet</p>
            <p className="empty">
              {query || tagFilter
                ? "No matches for this search/tag."
                : view === "today"
                  ? "Schedule a task for today to fill this view."
                  : view === "inbox"
                    ? "Save a page or add a todo without a due date."
                    : "Add a task above to get started."}
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
                    <span className={`priority-tag p${priority}`}>P{priority}</span>
                    {todo.startAt ? (
                      <span className={`due-tag ${start.tone}`}>{start.text}</span>
                    ) : null}
                    {todo.dueAt ? (
                      <span className={`due-tag ${due.tone}`}>{due.text}</span>
                    ) : (
                      !todo.startAt ? (
                        <span className={`due-tag ${due.tone}`}>{due.text}</span>
                      ) : null
                    )}
                    {todo.recurrence && todo.recurrence !== "none" ? (
                      <span className="due-tag">{todo.recurrence}</span>
                    ) : null}
                    {(todo.tags || []).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="tag-mini"
                        onClick={() => setTagFilter(tag)}
                      >
                        #{tag}
                      </button>
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
            );
          })}
        </ul>
      </section>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
