import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { t, uiLocale } from "../shared/i18n";
import "../../node_modules/@fontsource/figtree/400.css";
import "../../node_modules/@fontsource/figtree/500.css";
import "../../node_modules/@fontsource/figtree/600.css";
import "../../node_modules/@fontsource/figtree/700.css";
import "./popup.css";

const VIEW_IDS = ["all", "today", "upcoming", "inbox", "completed"];

const VIEW_MESSAGE_KEYS = {
  all: "viewAll",
  today: "viewToday",
  upcoming: "viewUpcoming",
  inbox: "viewInbox",
  completed: "viewDone",
};

const PRIORITIES = [
  { value: 1, label: "P1" },
  { value: 2, label: "P2" },
  { value: 3, label: "P3" },
  { value: 4, label: "P4" },
];

const RECURRENCE_LABEL_KEYS = {
  none: "repeatNone",
  daily: "repeatDaily",
  weekly: "repeatWeekly",
};

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

function tf(key, fallback) {
  const value = t(key);
  return !value || value === key ? fallback : value;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseDatetimeLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDatetimeDisplay(value) {
  const date = parseDatetimeLocal(value);
  if (!date) return "";
  return date.toLocaleString(uiLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildDatetimeLocal(date, hour12, minute, period) {
  let hours = hour12 % 12;
  if (period === "PM") hours += 12;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}T${pad2(hours)}:${pad2(minute)}`;
}

function useDropPlacement(open, rootRef, estimatedHeight) {
  const [dropUp, setDropUp] = useState(false);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setDropUp(false);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    setDropUp(spaceBelow < estimatedHeight && spaceAbove > spaceBelow);
  }, [open, estimatedHeight]);

  return dropUp;
}

function FancySelect({ value, options, onChange, ariaLabel, compact = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((opt) => opt.value === value) || options[0];
  const menuHeight = compact
    ? Math.min(140, 8 + options.length * 30)
    : Math.min(220, 12 + options.length * 40);
  const dropUp = useDropPlacement(open, rootRef, menuHeight);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`fancy-select${compact ? " compact" : ""}${
        open ? " open" : ""
      }${dropUp ? " drop-up" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="fancy-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected?.label}</span>
        <span className="fancy-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fancy-menu" role="listbox">
          <div className="fancy-menu-scroll">
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`fancy-option${
                  opt.value === value ? " active" : ""
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FancyDateTime({ value, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const dropUp = useDropPlacement(open, rootRef, 320);
  const initial = parseDatetimeLocal(value) || new Date();
  const [cursor, setCursor] = useState(
    () => new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(() =>
    value ? initial : null
  );
  const [hour12, setHour12] = useState(() => {
    const h = initial.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState(() => initial.getMinutes());
  const [period, setPeriod] = useState(() =>
    initial.getHours() >= 12 ? "PM" : "AM"
  );

  useEffect(() => {
    if (!open) return undefined;
    const parsed = parseDatetimeLocal(value);
    const base = parsed || new Date();
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setSelectedDay(parsed ? base : null);
    const h = base.getHours() % 12;
    setHour12(h === 0 ? 12 : h);
    setMinute(base.getMinutes());
    setPeriod(base.getHours() >= 12 ? "PM" : "AM");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const monthLabel = cursor.toLocaleString(uiLocale(), {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0
  ).getDate();
  const startWeekday = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    1
  ).getDay();
  const today = new Date();
  const commit = (dayDate, nextHour = hour12, nextMinute = minute, nextPeriod = period) => {
    const next = buildDatetimeLocal(dayDate, nextHour, nextMinute, nextPeriod);
    onChange(next);
  };

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2024, 0, 7 + i);
    return date.toLocaleDateString(uiLocale(), { weekday: "short" });
  });

  return (
    <div
      className={`fancy-datetime${open ? " open" : ""}${
        dropUp ? " drop-up" : ""
      }`}
      ref={rootRef}
    >
      <button
        type="button"
        className="fancy-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? "" : "placeholder"}>
          {value
            ? formatDatetimeDisplay(value)
            : tf("reminderPlaceholder", "Pick date & time")}
        </span>
        <span className="fancy-cal" aria-hidden="true">
          <Icon size={16}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </Icon>
        </span>
      </button>
      {open ? (
        <div className="fancy-picker" role="dialog">
          <div className="fancy-picker-head">
            <button
              type="button"
              className="fancy-nav"
              aria-label="Previous month"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              className="fancy-nav"
              aria-label="Next month"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
                )
              }
            >
              ›
            </button>
          </div>

          <div className="fancy-weekdays">
            {weekdayLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="fancy-days">
            {Array.from({ length: startWeekday }).map((_, i) => (
              <span key={`pad-${i}`} className="fancy-day empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(
                cursor.getFullYear(),
                cursor.getMonth(),
                day
              );
              const isSelected =
                selectedDay &&
                selectedDay.getFullYear() === date.getFullYear() &&
                selectedDay.getMonth() === date.getMonth() &&
                selectedDay.getDate() === date.getDate();
              const isToday =
                today.getFullYear() === date.getFullYear() &&
                today.getMonth() === date.getMonth() &&
                today.getDate() === date.getDate();
              return (
                <button
                  key={day}
                  type="button"
                  className={`fancy-day${isSelected ? " selected" : ""}${
                    isToday ? " today" : ""
                  }`}
                  onClick={() => {
                    setSelectedDay(date);
                    commit(date);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="fancy-time">
            <label>
              {tf("hour", "Hour")}
              <FancySelect
                compact
                ariaLabel={tf("hour", "Hour")}
                value={hour12}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: i + 1,
                  label: pad2(i + 1),
                }))}
                onChange={(next) => {
                  setHour12(next);
                  if (selectedDay) commit(selectedDay, next, minute, period);
                }}
              />
            </label>
            <label>
              {tf("minute", "Min")}
              <FancySelect
                compact
                ariaLabel={tf("minute", "Min")}
                value={minute}
                options={Array.from({ length: 60 }, (_, i) => ({
                  value: i,
                  label: pad2(i),
                }))}
                onChange={(next) => {
                  setMinute(next);
                  if (selectedDay) commit(selectedDay, hour12, next, period);
                }}
              />
            </label>
            <label>
              {tf("period", "AM/PM")}
              <FancySelect
                compact
                ariaLabel={tf("period", "AM/PM")}
                value={period}
                options={[
                  { value: "AM", label: "AM" },
                  { value: "PM", label: "PM" },
                ]}
                onChange={(next) => {
                  setPeriod(next);
                  if (selectedDay) commit(selectedDay, hour12, minute, next);
                }}
              />
            </label>
          </div>

          <div className="fancy-picker-actions">
            <button
              type="button"
              className="fancy-link"
              onClick={() => {
                onChange("");
                setSelectedDay(null);
                setOpen(false);
              }}
            >
              {tf("pickerClear", "Clear")}
            </button>
            <button
              type="button"
              className="fancy-link"
              onClick={() => {
                const now = new Date();
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDay(now);
                const h = now.getHours() % 12;
                const nextHour = h === 0 ? 12 : h;
                const nextMinute = now.getMinutes();
                const nextPeriod = now.getHours() >= 12 ? "PM" : "AM";
                setHour12(nextHour);
                setMinute(nextMinute);
                setPeriod(nextPeriod);
                commit(now, nextHour, nextMinute, nextPeriod);
              }}
            >
              {tf("viewToday", "Today")}
            </button>
            <button
              type="button"
              className="fancy-done"
              onClick={() => {
                if (!selectedDay) {
                  const now = new Date();
                  commit(now);
                }
                setOpen(false);
              }}
            >
              {tf("pickerDone", "Done")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatRelativeDue(timestamp, { kind = "due" } = {}) {
  if (!timestamp) {
    return {
      text: kind === "start" ? t("noStartTime") : t("noDueDate"),
      tone: "muted",
    };
  }
  const now = Date.now();
  const diff = timestamp - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const label = kind === "start" ? t("labelStarts") : t("labelDue");
  const overdueLabel =
    kind === "start" ? t("labelStartWas") : t("labelOverdue");

  if (diff < 0) {
    if (mins < 60) {
      return {
        text: t("relativeAgoMins", [overdueLabel, String(mins)]),
        tone: "overdue",
      };
    }
    if (hours < 48) {
      return {
        text: t("relativeAgoHours", [overdueLabel, String(hours)]),
        tone: "overdue",
      };
    }
    return {
      text: t("relativeAgoDays", [overdueLabel, String(days)]),
      tone: "overdue",
    };
  }
  if (mins < 60) {
    return {
      text: t("relativeInMins", [label, String(mins)]),
      tone: "soon",
    };
  }
  if (hours < 24) {
    return {
      text: t("relativeInHours", [label, String(hours)]),
      tone: "soon",
    };
  }
  if (days === 1) {
    return { text: t("relativeTomorrow", [label]), tone: "normal" };
  }
  return {
    text: t("relativeAt", [
      label,
      new Date(timestamp).toLocaleString(uiLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ]),
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
    VIEW_IDS.forEach((id) => {
      counts[id] = filterTodos(todos, id, { query }).length;
    });
    return counts;
  }, [todos, query]);
  const visibleTodos = useMemo(
    () => sortTodos(filterTodos(todos, view, { query })),
    [todos, view, query]
  );
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(uiLocale(), {
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
      setError(t("titleRequired"));
      return;
    }
    if (form.reminderAt && Number.isNaN(reminderMs)) {
      setError(t("reminderInvalid"));
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
    setStatus(wasEditing ? t("todoUpdated") : t("todoSaved"));
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
        setStatus(t("pageCantSave"));
        return;
      }
      const todo = createTodo({
        title: (tab.title || t("untitledPage")).slice(0, 120),
        url: tab.url,
      });
      await persist([...todos, todo]);
      setView("inbox");
      setStatus(t("pageAddedInbox"));
    } catch {
      setStatus(t("couldNotReadTab"));
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
    setStatus(t("clearedCompleted"));
  };

  const exportTodos = () => {
    const payload = exportTodosPayload(todos);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quicktask-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(t("exportedBackup"));
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
      setStatus(t("importedTodos", String(imported.length)));
    } catch {
      setError(t("importFailed"));
    }
  };

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="app">
      <header className="header">
        <div className="brand-row">
          <img className="brand-mark" src="icon-48.png" alt="" width="34" height="34" aria-hidden="true" />
          <div>
            <p className="eyebrow">{todayLabel}</p>
            <h1>{t("actionTitle")}</h1>
          </div>
          {screen === "list" ? (
            <div className="header-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={exportTodos}
                title={t("export")}
                aria-label={t("export")}
              >
                <ExportIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => importRef.current?.click()}
                title={t("import")}
                aria-label={t("import")}
              >
                <ImportIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => chrome.runtime.openOptionsPage()}
                title={t("settings")}
                aria-label={t("settings")}
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
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
            />
          </div>

          <div className="view-tabs" role="tablist" aria-label={t("viewsAria")}>
            {VIEW_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                className={`view-tab${view === id ? " active" : ""}`}
                onClick={() => setView(id)}
              >
                <span>{t(VIEW_MESSAGE_KEYS[id])}</span>
                <span className="view-count">{viewCounts[id] || 0}</span>
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
                  {t("clearAll")}
                </button>
              </div>
            ) : null}

            {loading ? <p className="muted">{t("loading")}</p> : null}
            {!loading && visibleTodos.length === 0 ? (
              <div className="empty-card">
                <p className="empty-title">{t("emptyTitle")}</p>
                <p className="empty">
                  {query ? t("emptySearch") : t("emptyHint")}
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
                          <span className="due-tag">
                            {t(
                              RECURRENCE_LABEL_KEYS[todo.recurrence] ||
                                "repeatNone"
                            )}
                          </span>
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
                        title={t("edit")}
                        aria-label={t("edit")}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removeTodo(todo.id)}
                        title={t("delete")}
                        aria-label={t("delete")}
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
              {t("savePage")}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={openAddForm}
            >
              {t("newTodo")}
            </button>
          </div>
        </>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <h2 className="form-title">
            {editingId ? t("editTodo") : t("newTodo")}
          </h2>

          <label>
            {t("titleLabel")}
            <input
              className="quick-input"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("titlePlaceholder")}
              maxLength={120}
              autoFocus
            />
          </label>

          <div className="priority-row" role="group" aria-label={t("priorityAria")}>
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
              {t("notes")}
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={t("notesPlaceholder")}
                rows={2}
                maxLength={300}
              />
            </label>

            <label>
              {t("tags")}
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder={t("tagsPlaceholder")}
              />
            </label>

            <label>
              {t("repeat")}
              <FancySelect
                ariaLabel={t("repeat")}
                value={form.recurrence}
                onChange={(recurrence) => setForm({ ...form, recurrence })}
                options={[
                  { value: "none", label: t("repeatNone") },
                  { value: "daily", label: t("repeatDaily") },
                  { value: "weekly", label: t("repeatWeekly") },
                ]}
              />
            </label>

            <label>
              {t("reminder")}
              <FancyDateTime
                ariaLabel={t("reminder")}
                value={form.reminderAt}
                onChange={(reminderAt) => setForm({ ...form, reminderAt })}
              />
            </label>
            <p className="hint">{t("reminderHint")}</p>

            {editingId ? (
              <label>
                {t("link")}
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder={t("linkPlaceholder")}
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
              {t("close")}
            </button>
            <button type="submit" className="btn primary">
              {t("save")}
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
