import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Titonova — Jobs in Nepal", short_name: "Titonova", description: "Find work and hire local talent in Nepal.", start_url: "/", display: "standalone", background_color: "#faf8f3", theme_color: "#2c302b", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
