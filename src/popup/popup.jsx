import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createTodo,
  getTodos,
  requestAlarmSync,
  saveTodos,
  sortTodos,
} from "../shared/todos";
import "./popup.css";

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

const emptyForm = {
  title: "",
  description: "",
  dueAt: "",
};

const App = () => {
  const [todos, setTodos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const dueMs = form.dueAt ? new Date(form.dueAt).getTime() : NaN;

    if (!title) {
      setError("Title is required.");
      return;
    }
    if (!form.dueAt || Number.isNaN(dueMs)) {
      setError("Due date and time are required.");
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
          notified: dueChanged ? false : todo.notified,
        };
      });
      await persist(next);
    } else {
      const todo = createTodo({
        title,
        description: form.description,
        dueAt: dueMs,
      });
      await persist([...todos, todo]);
    }

    resetForm();
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
        <p>Get a Chrome notification when a todo is due.</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs doing?"
            maxLength={120}
          />
        </label>

        <label>
          Description
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

        {error ? <p className="error">{error}</p> : null}

        <div className="form-actions">
          <button type="submit" className="btn primary">
            {editingId ? "Save changes" : "Add todo"}
          </button>
          {editingId ? (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <section className="list-section">
        <h2>Your todos</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && todos.length === 0 ? (
          <p className="empty">No todos yet. Add one above.</p>
        ) : null}
        <ul className="todo-list">
          {todos.map((todo) => (
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
                <p className="todo-due">
                  Due {formatDue(todo.dueAt)}
                  {todo.notified && !todo.completed ? " · notified" : ""}
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
