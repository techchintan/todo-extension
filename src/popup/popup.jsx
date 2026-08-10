import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

const App = () => {
 
  return (
    <div>
      <div className="heading">Chrome Extension</div>
      
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);
