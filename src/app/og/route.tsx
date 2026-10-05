import { ImageResponse } from "next/og";

/** The picture shown when the home page is shared in a message, Slack, X, LinkedIn and so on. */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#fafafa",
          background: "radial-gradient(circle at 20% 0%, rgba(99,102,241,0.55), rgba(10,10,10,1) 55%), #0a0a0a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
              color: "#0a0a0a",
              background: "linear-gradient(135deg, #818cf8, #f472b6)",
            }}
          >
            ↗
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>TapAndLaunch</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Your app, one tap from launch.</div>
          <div style={{ display: "flex", fontSize: 36, color: "#a3a3a3" }}>Build an app for your business. No code. Free for 30 days.</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
