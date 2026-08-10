export const STORAGE_KEY = "todos";
export const ALARM_PREFIX = "todo-";

export function alarmNameForTodo(id) {
  return `${ALARM_PREFIX}${id}`;
}

export function todoIdFromAlarmName(name) {
  if (!name || !name.startsWith(ALARM_PREFIX)) {
    return null;
  }
  return name.slice(ALARM_PREFIX.length);
}

export async function getTodos() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

export async function saveTodos(todos) {
  await chrome.storage.local.set({ [STORAGE_KEY]: todos });
}

export function createTodo({ title, description, dueAt, url }) {
  const due = dueAt == null || dueAt === "" ? null : Number(dueAt);
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || "").trim(),
    dueAt: Number.isFinite(due) ? due : null,
    url: (url || "").trim(),
    completed: false,
    notified: false,
    createdAt: Date.now(),
  };
}

export function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
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

export function filterTodos(todos, view) {
  const start = startOfDay();
  const end = endOfDay();

  switch (view) {
    case "today":
      return todos.filter(
        (todo) =>
          !todo.completed &&
          todo.dueAt != null &&
          todo.dueAt >= start &&
          todo.dueAt <= end
      );
    case "upcoming":
      return todos.filter(
        (todo) => !todo.completed && todo.dueAt != null && todo.dueAt > end
      );
    case "inbox":
      return todos.filter((todo) => !todo.completed && todo.dueAt == null);
    case "completed":
      return todos.filter((todo) => todo.completed);
    case "all":
    default:
      return todos.filter((todo) => !todo.completed);
  }
}

export async function addTodo(fields) {
  const todos = await getTodos();
  const todo = createTodo(fields);
  const next = sortTodos([...todos, todo]);
  await saveTodos(next);
  await requestAlarmSync();
  return todo;
}

export async function requestAlarmSync() {
  try {
    await chrome.runtime.sendMessage({ type: "SYNC_ALARMS" });
  } catch {
    // Service worker may be waking; storage listener also syncs.
  }
}
