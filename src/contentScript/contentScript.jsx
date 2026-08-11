import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./contentScript.css";

const App = () => {
  return <div className="tr-root"></div>;
};

const host = document.createElement("div");
host.id = "todo-reminder-root";
document.documentElement.appendChild(host);
const root = createRoot(host);
root.render(<App />);
