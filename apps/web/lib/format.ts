export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Guatemala",
  }).format(new Date(iso));
}

export function scopeLabel(scope: "ethiopia" | "international"): string {
  return scope === "ethiopia" ? "Ethiopia" : "International";
}
