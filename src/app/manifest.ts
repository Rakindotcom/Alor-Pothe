import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "আলোর পথে — পারিবারিক যিকির ট্র্যাকার",
    short_name: "আলোর পথে",
    description: "আল্লাহর স্মরণে আমরা সবাই একসাথে — পারিবারিক যিকির ট্র্যাকার",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF9F6",
    theme_color: "#14532D",
    lang: "bn",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
