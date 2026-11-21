import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spendr",
    short_name: "Spendr",
    description: "My personal financial dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    orientation: "any",
    icons: [
      {
        src: "/spendr-favicon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/spendr-favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
