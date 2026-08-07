import type { ReactNode } from "react";

/**
 * Layout for proctored/timed test experiences — deliberately bare. No
 * Sidebar, no SidebarProvider, no app chrome. AuthProvider/ThemeProvider/
 * ToastProvider still apply since they're mounted in the root layout.
 *
 * The <noscript> block is the only defense we have against #6 ("user
 * can't disable JavaScript") — it's not enforcement (nothing can run
 * without JS), just honest messaging so a JS-disabled visitor sees a
 * clear explanation instead of a blank page.
 */
export default function TestLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <noscript>
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            background: "#020617",
            color: "#f1f5f9",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              JavaScript is required
            </h1>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
              This assessment relies on JavaScript for timing, integrity checks, and
              submission. Please enable JavaScript in your browser and reload this
              page to continue.
            </p>
          </div>
        </div>
      </noscript>
      {children}
    </div>
  );
}