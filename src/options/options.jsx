import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings, saveSettings } from "../shared/todos";
import { t } from "../shared/i18n";
import "./options.css";

const App = () => {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setSyncEnabled(Boolean(settings.syncEnabled));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async (enabled) => {
    setSyncEnabled(enabled);
    setStatus("");
    try {
      await saveSettings({ syncEnabled: enabled });
      setStatus(enabled ? t("syncOnStatus") : t("syncOffStatus"));
    } catch {
      setStatus(t("saveSettingsFailed"));
    }
  };

  return (
    <div className="options">
      <header>
        <img src="icon-128.png" alt="" width="40" height="40" />
        <div>
          <h1>{t("optionsTitle")}</h1>
          <p>{t("optionsSubtitle")}</p>
        </div>
      </header>

      {loading ? <p className="muted">{t("loading")}</p> : null}

      <section className="card">
        <h2>{t("chromeSync")}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => save(e.target.checked)}
          />
          <span>{t("syncToggle")}</span>
        </label>
        <p className="hint">{t("syncHint")}</p>
        {status ? <p className="status">{status}</p> : null}
      </section>

      <section className="card">
        <h2>{t("remindersTitle")}</h2>
        <p>{t("remindersIntro")}</p>
        <ul className="list">
          <li>{t("remindersOneTime")}</li>
          <li>{t("remindersRecurring")}</li>
        </ul>
        <p className="hint">{t("remindersClickHint")}</p>
      </section>

      <section className="card">
        <h2>{t("saveFromWebTitle")}</h2>
        <ul className="list">
          <li>{t("saveFromWebSavePage")}</li>
          <li>{t("saveFromWebAddPage")}</li>
          <li>{t("saveFromWebAddSelection")}</li>
        </ul>
      </section>

      <section className="card">
        <h2>{t("organizeTitle")}</h2>
        <ul className="list">
          <li>{t("organizeViews")}</li>
          <li>{t("organizePriorities")}</li>
          <li>{t("organizeRepeat")}</li>
        </ul>
      </section>

      <section className="card">
        <h2>{t("shortcutTitle")}</h2>
        <p>{t("shortcutDefault")}</p>
        <p className="hint">{t("shortcutHint")}</p>
      </section>

      <section className="card">
        <h2>{t("backupTitle")}</h2>
        <p>{t("backupBody")}</p>
        <p className="hint">{t("backupHint")}</p>
      </section>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
