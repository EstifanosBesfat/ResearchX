import { spawn } from "child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

export interface IngestCliResult {
  paperId: string;
  externalId: string | null;
  action: string;
}

export function ingestWorkingDirectory(): string {
  const candidates = [
    path.resolve(__dirname, "../../../../services/ingest"),
    path.resolve(__dirname, "../../../services/ingest"),
    path.resolve(process.cwd(), "services/ingest"),
    path.resolve(process.cwd(), "../../services/ingest"),
  ];
  const found = candidates.find((candidate) => existsSync(path.join(candidate, "ingest", "__main__.py")));
  if (!found) {
    throw new Error("Could not find services/ingest.");
  }
  return found;
}

export function runIngest(args: string[]): Promise<IngestCliResult> {
  const cwd = ingestWorkingDirectory();
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-m", "ingest", ...args], {
      cwd,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Ingest timed out."));
    }, 8 * 60 * 1000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = stderr.trim().split("\n").slice(-8).join(" ");
        reject(new Error(detail || `Ingest exited with status ${code}.`));
        return;
      }
      const line = stdout
        .trim()
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry.startsWith("{"))
        .pop();
      if (!line) {
        reject(new Error("Ingest did not return a paper id."));
        return;
      }
      const parsed = JSON.parse(line) as IngestCliResult;
      if (!parsed.paperId) {
        reject(new Error("Ingest did not return a paper id."));
        return;
      }
      resolve(parsed);
    });
  });
}

export function writeUpload(file: Buffer, metadata: unknown): { directory: string; pdfPath: string; metadataPath: string } {
  const directory = mkdtempSync(path.join(tmpdir(), "researchx-"));
  const pdfPath = path.join(directory, "paper.pdf");
  const metadataPath = path.join(directory, "metadata.json");
  writeFileSync(pdfPath, file);
  writeFileSync(metadataPath, JSON.stringify(metadata));
  return { directory, pdfPath, metadataPath };
}

export function removeUpload(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}

export function looksLikePdf(file: Buffer): boolean {
  return file.subarray(0, 5).toString("utf8") === "%PDF-";
}
