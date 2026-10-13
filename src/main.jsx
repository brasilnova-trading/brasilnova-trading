
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function showError(message) {
  let box = document.getElementById("app-error");
  if (!box) {
    box = document.createElement("pre");
    box.id = "app-error";
    document.body.appendChild(box);
  }

  Object.assign(box.style, {
    padding: "20px",
    color: "#b00020",
    background: "#fff",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: "14px"
  });

  box.textContent = "APP ERROR:\n" + message;
}

window.addEventListener("error", (event) => {
  showError(event.message || "Unknown JavaScript error");
});

window.addEventListener("unhandledrejection", (event) => {
  showError(event.reason?.stack || event.reason?.message || String(event.reason));
});

try {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing root element in index.html");

  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  showError(error.stack || error.message);
}
