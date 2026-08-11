export const STORAGE_KEY = "todos";
export const SETTINGS_KEY = "settings";
export const ALARM_PREFIX = "todo-";
export const DUE_ALARM_PREFIX = "todo-due-";
export const START_ALARM_PREFIX = "todo-start-";
export const NOTIFICATION_PREFIX = "todo-notification-";
export const DUE_NOTIFICATION_PREFIX = "todo-notification-due-";
export const START_NOTIFICATION_PREFIX = "todo-notification-start-";

export const DEFAULT_SETTINGS = {
  syncEnabled: false,
};

export function dueAlarmNameForTodo(id) {
  return `${DUE_ALARM_PREFIX}${id}`;
}

export function startAlarmNameForTodo(id) {
  return `${START_ALARM_PREFIX}${id}`;
}

/** @deprecated use dueAlarmNameForTodo */
export function alarmNameForTodo(id) {
  return dueAlarmNameForTodo(id);
}

export function parseAlarmName(name) {
  if (!name) return null;
  if (name.startsWith(START_ALARM_PREFIX)) {
    return { type: "start", id: name.slice(START_ALARM_PREFIX.length) };
  }
  if (name.startsWith(DUE_ALARM_PREFIX)) {
    return { type: "due", id: name.slice(DUE_ALARM_PREFIX.length) };
  }
  // Legacy due alarms: "todo-{uuid}"
  if (name.startsWith(ALARM_PREFIX)) {
    return { type: "due", id: name.slice(ALARM_PREFIX.length) };
  }
  return null;
}

export function todoIdFromAlarmName(name) {
  return parseAlarmName(name)?.id || null;
}

export function dueNotificationIdForTodo(id) {
  return `${DUE_NOTIFICATION_PREFIX}${id}`;
}

export function startNotificationIdForTodo(id) {
  return `${START_NOTIFICATION_PREFIX}${id}`;
}

export function notificationIdForTodo(id) {
  return dueNotificationIdForTodo(id);
}

export function parseNotificationId(id) {
  if (!id) return null;
  if (id.startsWith(START_NOTIFICATION_PREFIX)) {
    return { type: "start", id: id.slice(START_NOTIFICATION_PREFIX.length) };
  }
  if (id.startsWith(DUE_NOTIFICATION_PREFIX)) {
    return { type: "due", id: id.slice(DUE_NOTIFICATION_PREFIX.length) };
  }
  if (id.startsWith(NOTIFICATION_PREFIX)) {
    return { type: "due", id: id.slice(NOTIFICATION_PREFIX.length) };
  }
  return null;
}

export function todoIdFromNotificationId(id) {
  return parseNotificationId(id)?.id || null;
}

export async function getSettings() {
  const local = await chrome.storage.local.get(SETTINGS_KEY);
  const sync = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(sync[SETTINGS_KEY] || {}),
    ...(local[SETTINGS_KEY] || {}),
  };
}

export async function saveSettings(settings) {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  } catch {
    // Sync quota/unavailable — local settings still saved.
  }
  return next;
}

function mergeTodoLists(localTodos, syncTodos) {
  const map = new Map();
  [...(syncTodos || []), ...(localTodos || [])].forEach((todo) => {
    if (!todo?.id) return;
    const existing = map.get(todo.id);
    if (!existing || (todo.updatedAt || 0) >= (existing.updatedAt || 0)) {
      map.set(todo.id, todo);
    }
  });
  return sortTodos([...map.values()]);
}

export async function getTodos() {
  const settings = await getSettings();
  const localResult = await chrome.storage.local.get(STORAGE_KEY);
  const localTodos = Array.isArray(localResult[STORAGE_KEY])
    ? localResult[STORAGE_KEY]
    : [];

  if (!settings.syncEnabled) {
    return localTodos;
  }

  try {
    const syncResult = await chrome.storage.sync.get(STORAGE_KEY);
    const syncTodos = Array.isArray(syncResult[STORAGE_KEY])
      ? syncResult[STORAGE_KEY]
      : [];
    if (!syncTodos.length) return localTodos;
    const merged = mergeTodoLists(localTodos, syncTodos);
    await chrome.storage.local.set({ [STORAGE_KEY]: merged });
    return merged;
  } catch {
    return localTodos;
  }
}

export async function saveTodos(todos) {
  const sorted = sortTodos(todos);
  await chrome.storage.local.set({ [STORAGE_KEY]: sorted });

  const settings = await getSettings();
  if (settings.syncEnabled) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: sorted });
    } catch (error) {
      console.warn("Chrome sync save failed (quota or offline)", error);
    }
  }

  return sorted;
}

export function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  }
  if (typeof tags === "string") {
    return [
      ...new Set(
        tags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }
  return [];
}

export function createTodo({
  title,
  description,
  dueAt,
  startAt,
  url,
  priority,
  tags,
  recurrence,
}) {
  const due = dueAt == null || dueAt === "" ? null : Number(dueAt);
  const start = startAt == null || startAt === "" ? null : Number(startAt);
  const level = Number(priority);
  const recur = ["daily", "weekly"].includes(recurrence) ? recurrence : "none";
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || "").trim(),
    dueAt: Number.isFinite(due) ? due : null,
    startAt: Number.isFinite(start) ? start : null,
    url: (url || "").trim(),
    priority: [1, 2, 3, 4].includes(level) ? level : 4,
    tags: normalizeTags(tags),
    recurrence: recur,
    completed: false,
    notified: false,
    startNotified: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    const aPriority = a.priority || 4;
    const bPriority = b.priority || 4;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aDue = a.dueAt == null ? Number.POSITIVE_INFINITY : a.dueAt;
    const bDue = b.dueAt == null ? Number.POSITIVE_INFINITY : b.dueAt;
    if (aDue !== bDue) return aDue - bDue;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function startOfDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function nextDueAt(dueAt, recurrence) {
  if (!["daily", "weekly"].includes(recurrence)) return null;
  const base = dueAt != null ? Number(dueAt) : Date.now();
  const date = new Date(Number.isFinite(base) ? base : Date.now());
  const step = () => {
    if (recurrence === "daily") date.setDate(date.getDate() + 1);
    else date.setDate(date.getDate() + 7);
  };
  step();
  while (date.getTime() <= Date.now()) {
    step();
  }
  return date.getTime();
}

export function nextOccurrenceAt(timestamp, recurrence) {
  return nextDueAt(timestamp, recurrence);
}

export function filterTodos(todos, view, { query = "", tag = "" } = {}) {
  const start = startOfDay();
  const end = endOfDay();
  const now = Date.now();
  const q = query.trim().toLowerCase();
  const tagFilter = tag.trim().toLowerCase();

  let list;
  switch (view) {
    case "today":
      list = todos.filter((todo) => {
        if (todo.completed) return false;
        const dueToday =
          todo.dueAt != null && todo.dueAt <= end;
        const startsToday =
          todo.startAt != null && todo.startAt <= end;
        return dueToday || startsToday;
      });
      break;
    case "upcoming":
      list = todos.filter((todo) => {
        if (todo.completed) return false;
        if (todo.dueAt != null) return todo.dueAt > end;
        return todo.startAt != null && todo.startAt > end;
      });
      break;
    case "inbox":
      list = todos.filter(
        (todo) =>
          !todo.completed && todo.dueAt == null && todo.startAt == null
      );
      break;
    case "completed":
      list = todos.filter((todo) => todo.completed);
      break;
    case "all":
    default:
      list = todos.filter((todo) => !todo.completed);
      break;
  }

  if (tagFilter) {
    list = list.filter((todo) =>
      (todo.tags || []).includes(tagFilter)
    );
  }

  if (q) {
    list = list.filter((todo) => {
      const haystack = [
        todo.title,
        todo.description,
        todo.url,
        ...(todo.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  // Prefer overdue first within today/all lists
  if (view === "today" || view === "all") {
    return [...list].sort((a, b) => {
      const aOver = a.dueAt != null && a.dueAt < now ? 0 : 1;
      const bOver = b.dueAt != null && b.dueAt < now ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return 0;
    });
  }

  return list;
}

export function collectTags(todos) {
  const set = new Set();
  todos.forEach((todo) => {
    (todo.tags || []).forEach((tag) => set.add(tag));
  });
  return [...set].sort();
}

export function exportTodosPayload(todos) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos,
  };
}

export function parseImportPayload(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  const list = Array.isArray(data) ? data : data?.todos;
  if (!Array.isArray(list)) {
    throw new Error("Invalid backup file");
  }
  return list
    .filter((item) => item && typeof item.title === "string")
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      title: String(item.title).trim(),
      description: (item.description || "").trim(),
      dueAt:
        item.dueAt == null || item.dueAt === ""
          ? null
          : Number(item.dueAt),
      startAt:
        item.startAt == null || item.startAt === ""
          ? null
          : Number(item.startAt),
      url: (item.url || "").trim(),
      priority: [1, 2, 3, 4].includes(Number(item.priority))
        ? Number(item.priority)
        : 4,
      tags: normalizeTags(item.tags),
      recurrence: ["daily", "weekly"].includes(item.recurrence)
        ? item.recurrence
        : "none",
      completed: Boolean(item.completed),
      notified: Boolean(item.notified),
      startNotified: Boolean(item.startNotified),
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Date.now(),
    }));
}

export async function addTodo(fields) {
  const todos = await getTodos();
  const todo = createTodo(fields);
  const next = await saveTodos([...todos, todo]);
  await requestAlarmSync();
  return next.find((item) => item.id === todo.id) || todo;
}

export async function updateTodos(mutator) {
  const todos = await getTodos();
  const next = await saveTodos(mutator(todos));
  await requestAlarmSync();
  return next;
}

export async function requestAlarmSync() {
  try {
    await chrome.runtime.sendMessage({ type: "SYNC_ALARMS" });
  } catch {
    // Service worker may be waking; storage listener also syncs.
  }
}
