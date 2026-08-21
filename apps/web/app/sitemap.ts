import type { MetadataRoute } from "next";
import { crisisScenarios } from "@oyano/shared";
import { guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const staticPaths = [
    "",
    "/home",
    "/crisis",
    "/guides",
    "/checklists",
    "/safety",
    "/plans",
    "/start",
    "/providers",
    "/support-pack",
    "/legal/privacy",
    "/legal/terms",
    "/legal/tokushoho",
    "/legal/disclaimer"
  ];

  return [
    ...staticPaths.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date()
    })),
    ...crisisScenarios.map((scenario) => ({
      url: `${baseUrl}/crisis/${scenario.key}`,
      lastModified: new Date()
    })),
    ...guides.map((guide) => ({
      url: `${baseUrl}/guides/${guide.slug}`,
      lastModified: new Date()
    }))
  ];
}
