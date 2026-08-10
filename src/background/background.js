import {
  addTodo,
  alarmNameForTodo,
  getTodos,
  saveTodos,
  todoIdFromAlarmName,
} from "../shared/todos";

const MENU_ADD_PAGE = "todo-add-page";
const MENU_ADD_SELECTION = "todo-add-selection";

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
          !todo.completed &&
          !todo.notified &&
          todo.dueAt != null &&
          Number(todo.dueAt) > now
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
  if (!todo || todo.completed || todo.notified || todo.dueAt == null) {
    return;
  }

  await chrome.notifications.create(`todo-notification-${todo.id}`, {
    type: "basic",
    iconUrl: "icon.png",
    title: "Todo due",
    message: todo.title,
    contextMessage: todo.description || todo.url || undefined,
    priority: 2,
    requireInteraction: true,
  });

  const next = todos.map((item) =>
    item.id === todoId ? { ...item, notified: true } : item
  );
  await saveTodos(next);
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ADD_PAGE,
      title: "Add page as todo",
      contexts: ["page", "action"],
    });
    chrome.contextMenus.create({
      id: MENU_ADD_SELECTION,
      title: "Add selection as todo",
      contexts: ["selection"],
    });
  });
}

async function createFromPage(tab, selectionText) {
  const pageUrl = tab?.url || "";
  const pageTitle = tab?.title || "Untitled page";
  const selected = (selectionText || "").trim();

  if (selected) {
    return addTodo({
      title: selected.slice(0, 120),
      description: `From: ${pageTitle}`,
      url: pageUrl,
    });
  }

  return addTodo({
    title: pageTitle.slice(0, 120),
    description: "",
    url: pageUrl,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  syncAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  syncAlarms();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_ADD_PAGE) {
      await createFromPage(tab);
    } else if (info.menuItemId === MENU_ADD_SELECTION) {
      await createFromPage(tab, info.selectionText);
    }
  } catch (error) {
    console.error("Failed to create todo from context menu", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SYNC_ALARMS") {
    syncAlarms()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "ADD_TODO") {
    addTodo(message.payload || {})
      .then((todo) => sendResponse({ ok: true, todo }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "ADD_PAGE_AS_TODO") {
    const tab = sender.tab;
    const selectionText = message.selectionText || "";
    createFromPage(tab, selectionText)
      .then((todo) => sendResponse({ ok: true, todo }))
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
