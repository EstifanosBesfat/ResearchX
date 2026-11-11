import path from "path";
import { config } from "dotenv";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  const roots = [
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of roots) {
    config({ path: file });
  }
  loaded = true;
}
