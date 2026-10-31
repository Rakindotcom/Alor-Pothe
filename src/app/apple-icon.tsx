import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 180, height: 180 };

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: "148px",
            height: "148px",
            borderRadius: "32px",
            border: "3px solid rgba(197, 164, 109, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
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
