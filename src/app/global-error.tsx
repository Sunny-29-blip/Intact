"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f6f2", color: "#1c1c1a", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #ddd", padding: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Intact could not load</h1>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 20px" }}>
              Your records are safe. Please try again in a moment.
            </p>
            <button
              onClick={reset}
              style={{ padding: "8px 16px", border: 0, background: "#1f5f5b", color: "#fff", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
