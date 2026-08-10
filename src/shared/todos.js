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

export function createTodo({ title, description, dueAt }) {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: (description || "").trim(),
    dueAt: Number(dueAt),
    completed: false,
    notified: false,
  };
}

export function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return a.dueAt - b.dueAt;
  });
}

export async function requestAlarmSync() {
  try {
    await chrome.runtime.sendMessage({ type: "SYNC_ALARMS" });
  } catch {
    // Service worker may be waking; storage listener also syncs.
  }
}
