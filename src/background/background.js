import {
  alarmNameForTodo,
  getTodos,
  saveTodos,
  todoIdFromAlarmName,
} from "../shared/todos";

async function clearTodoAlarms() {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => todoIdFromAlarmName(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );
}

async function syncAlarms() {
  const todos = await getTodos();
  const now = Date.now();

  await clearTodoAlarms();

  await Promise.all(
    todos
      .filter(
        (todo) =>
          !todo.completed && !todo.notified && Number(todo.dueAt) > now
      )
      .map((todo) =>
        chrome.alarms.create(alarmNameForTodo(todo.id), {
          when: Number(todo.dueAt),
        })
      )
  );
}

async function handleAlarm(alarm) {
  const todoId = todoIdFromAlarmName(alarm.name);
  if (!todoId) return;

  const todos = await getTodos();
  const todo = todos.find((item) => item.id === todoId);
  if (!todo || todo.completed || todo.notified) {
    return;
  }

  await chrome.notifications.create(`todo-notification-${todo.id}`, {
    type: "basic",
    iconUrl: "icon.png",
    title: "Todo due",
    message: todo.title,
    contextMessage: todo.description || undefined,
    priority: 2,
    requireInteraction: true,
  });

  const next = todos.map((item) =>
    item.id === todoId ? { ...item, notified: true } : item
  );
  await saveTodos(next);
}

chrome.runtime.onInstalled.addListener(() => {
  syncAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  syncAlarms();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SYNC_ALARMS") {
    syncAlarms()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.todos) {
    syncAlarms();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarm(alarm);
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  try {
    await chrome.action.openPopup();
  } catch {
    // openPopup is only available in limited contexts; ignore failures.
  }
  chrome.notifications.clear(notificationId);
});
