"use client";

import { Circle } from "lucide-react";
import { ICONS } from "./icons";

function normalize(name?: string): string {
  if (!name) return "";
  return name
    .replace(/^\s*(fa-solid|fa-regular|fa-brands|fa)\s+/g, "")
    .replace(/^fa-/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export default function LucideIcon({
  name,
  className = "",
  size = 18,
}: {
  name?: string;
  className?: string;
  size?: number;
}) {
  const key = normalize(name);
  const Icon = (key ? ICONS[key] : null) || Circle;
  return <Icon className={className} size={size} />;
}
