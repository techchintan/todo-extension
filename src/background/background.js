import {
  addTodo,
  dueAlarmNameForTodo,
  dueNotificationIdForTodo,
  getTodos,
  nextOccurrenceAt,
  parseAlarmName,
  parseNotificationId,
  saveTodos,
  startAlarmNameForTodo,
  startNotificationIdForTodo,
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

  const creates = [];

  todos.forEach((todo) => {
    if (todo.completed) return;

    if (
      !todo.startNotified &&
      todo.startAt != null &&
      Number(todo.startAt) > now
    ) {
      creates.push(
        chrome.alarms.create(startAlarmNameForTodo(todo.id), {
          when: Number(todo.startAt),
        })
      );
    }

    if (
      !todo.notified &&
      todo.dueAt != null &&
      Number(todo.dueAt) > now
    ) {
      creates.push(
        chrome.alarms.create(dueAlarmNameForTodo(todo.id), {
          when: Number(todo.dueAt),
        })
      );
    }
  });

  await Promise.all(creates);
}

async function refreshReminders() {
  await syncAlarms();
  await chrome.action.setBadgeText({ text: "" });
}

async function handleAlarm(alarm) {
  const parsed = parseAlarmName(alarm.name);
  if (!parsed) return;

  const todos = await getTodos();
  const todo = todos.find((item) => item.id === parsed.id);
  if (!todo || todo.completed) return;

  const isRecurring = todo.recurrence && todo.recurrence !== "none";

  if (parsed.type === "start") {
    if (todo.startNotified || todo.startAt == null) return;

    const startNotification = {
      type: "basic",
      iconUrl: "icon.png",
      title: "Todo starting",
      message: todo.title,
      contextMessage: todo.description || todo.url || undefined,
      priority: 2,
      requireInteraction: true,
      silent: false,
    };
    if (isRecurring) {
      startNotification.buttons = [{ title: "Complete" }];
    }
    await chrome.notifications.create(
      startNotificationIdForTodo(todo.id),
      startNotification
    );

    const next = todos.map((item) => {
      if (item.id !== parsed.id) return item;
      if (isRecurring) {
        return { ...item, startNotified: true, updatedAt: Date.now() };
      }
      return {
        ...item,
        completed: true,
        notified: true,
        startNotified: true,
        updatedAt: Date.now(),
      };
    });
    await saveTodos(next);
    await refreshReminders();
    return;
  }

  if (todo.notified || todo.dueAt == null) return;

  const dueNotification = {
    type: "basic",
    iconUrl: "icon.png",
    title: "Todo due",
    message: todo.title,
    contextMessage: todo.description || todo.url || undefined,
    priority: 2,
    requireInteraction: true,
    silent: false,
  };
  if (isRecurring) {
    dueNotification.buttons = [{ title: "Complete" }];
  }
  await chrome.notifications.create(
    dueNotificationIdForTodo(todo.id),
    dueNotification
  );

  const next = todos.map((item) => {
    if (item.id !== parsed.id) return item;
    if (isRecurring) {
      return { ...item, notified: true, updatedAt: Date.now() };
    }
    return {
      ...item,
      completed: true,
      notified: true,
      startNotified: true,
      updatedAt: Date.now(),
    };
  });
  await saveTodos(next);
  await refreshReminders();
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

async function completeTodoById(todoId) {
  const todos = await getTodos();
  const next = todos.map((todo) => {
    if (todo.id !== todoId) return todo;
    if (todo.recurrence && todo.recurrence !== "none") {
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
    return {
      ...todo,
      completed: true,
      notified: true,
      startNotified: true,
      updatedAt: Date.now(),
    };
  });
  await saveTodos(next);
  await refreshReminders();
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  refreshReminders();
});

chrome.runtime.onStartup.addListener(() => {
  refreshReminders();
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

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "quick-add-todo") return;
  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SYNC_ALARMS") {
    refreshReminders()
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

  if (message?.type === "COMPLETE_TODO") {
    completeTodoById(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    (area === "local" || area === "sync") &&
    (changes.todos || changes.settings)
  ) {
    refreshReminders();
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

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const parsed = parseNotificationId(notificationId);
  if (!parsed) return;

  if (buttonIndex === 0) {
    await completeTodoById(parsed.id);
  }

  chrome.notifications.clear(notificationId);
});
