import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("ZARBA.UC xatolik:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#12140F", color: "#F1EDE1", minHeight: "100vh", padding: 24, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
          <div style={{ color: "#E8A33D", fontSize: 16, marginBottom: 12, fontWeight: 700 }}>Saytda xatolik yuz berdi:</div>
          <div>{String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}</div>
          <div style={{ marginTop: 16, color: "#9BA187", fontSize: 12 }}>
            Bu matnni to'liq nusxalab, Claude'ga yuboring — aynan shu xatolikni tuzatadi.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root && !root.innerText) {
    root.innerHTML = `<div style="background:#12140F;color:#F1EDE1;min-height:100vh;padding:24px;font-family:monospace;font-size:13px;white-space:pre-wrap;"><div style="color:#E8A33D;font-size:16px;margin-bottom:12px;font-weight:700;">Skript xatoligi:</div>${(e.error && e.error.stack) || e.message}</div>`;
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
