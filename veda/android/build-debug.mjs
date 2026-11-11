import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const androidDir = fileURLToPath(new URL(".", import.meta.url));
const isWindows = process.platform === "win32";
const command = isWindows ? "gradlew.bat" : "sh";
const args = isWindows ? ["assembleDebug"] : ["gradlew", "assembleDebug"];
const result = spawnSync(command, args, {
  cwd: androidDir,
  stdio: "inherit",
  shell: isWindows
});

if (result.error) {
  console.error(`Could not start the Android Gradle wrapper: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);