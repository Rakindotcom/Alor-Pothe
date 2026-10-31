import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 512, height: 512 };

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #14532D 0%, #0D381E 100%)",
          borderRadius: "108px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "410px",
            height: "410px",
            borderRadius: "84px",
            border: "6px solid rgba(197, 164, 109, 0.55)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Radiant Gold Crescent & Star SVG */}
          <svg
            width="230"
            height="230"
            viewBox="0 0 100 100"
            fill="none"
          >
            <path
              d="M62 20A32 32 0 1 0 82 70A26 26 0 1 1 62 20Z"
              fill="#C5A46D"
            />
            <polygon
              points="70,30 73,39 82,39 75,44 77,53 70,48 63,53 65,44 58,39 67,39"
              fill="#DCFCE7"
            />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
