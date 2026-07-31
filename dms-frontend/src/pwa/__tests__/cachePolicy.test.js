import { describe, expect, it } from "vitest";
import { isPrivateResourceUrl } from "../cachePolicy";

describe("DrawVault PWA cache exclusions", () => {
  it.each([
    "/api/projects",
    "https://api.example.com/api/drawings?projectId=4",
    "/uploads/site-plan.pdf",
    "https://files.example.com/project/plan.DWG?X-Amz-Signature=secret",
    "https://r2.example.com/object?token=signed-value",
    "/documents/model.ifc",
    "/transmittals/package.rvt",
  ])("marks private project resource %s as network-only", url => {
    expect(isPrivateResourceUrl(url)).toBe(true);
  });

  it.each([
    "/",
    "/assets/index-abc123.js",
    "/assets/index-abc123.css",
    "/pwa/icon-192.png",
    "/privacy.html",
    "/offline.html",
  ])("allows public shell resource %s", url => {
    expect(isPrivateResourceUrl(url)).toBe(false);
  });
});

