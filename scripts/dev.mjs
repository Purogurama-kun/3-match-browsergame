import { spawn } from "node:child_process";
import readline from "node:readline";

const processes = [];
let shuttingDown = false;

const COLORS = {
    reset: "\u001b[0m",
    gray: "\u001b[90m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    cyan: "\u001b[36m",
    red: "\u001b[31m"
};

const LABELS = {
    server: `${COLORS.green}server${COLORS.reset}`,
    watch: `${COLORS.cyan}watch${COLORS.reset}`,
    templates: `${COLORS.yellow}templates${COLORS.reset}`
};

const formatTimestamp = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
};

const formatPrefix = (label) => {
    const timestamp = `${COLORS.gray}${formatTimestamp()}${COLORS.reset}`;
    return `${timestamp} [${label}]`;
};

const run = (name, command, options = {}) => {
    const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
    processes.push(child);

    const attach = (stream, label) => {
        const rl = readline.createInterface({ input: stream });
        rl.on("line", (line) => {
            process.stdout.write(`${formatPrefix(label)} ${line}\n`);
        });
        child.on("close", () => rl.close());
    };

    const stdoutLabel = LABELS[name] ?? name;
    const stderrLabel = options.stderrLabel ?? `${COLORS.red}${name}:err${COLORS.reset}`;
    attach(child.stdout, stdoutLabel);
    attach(child.stderr, stderrLabel);

    child.on("exit", (code, signal) => {
        if (shuttingDown) {
            return;
        }
        if (code !== 0) {
            process.stdout.write(`[${name}] exited with code ${code ?? "unknown"}\n`);
            shutdown();
            process.exit(code ?? 1);
            return;
        }
        if (signal) {
            process.stdout.write(`[${name}] exited with signal ${signal}\n`);
            shutdown();
            process.exit(1);
        }
    });
};

const shutdown = () => {
    shuttingDown = true;
    for (const child of processes) {
        if (!child.killed) {
            child.kill("SIGINT");
        }
    }
};

process.on("SIGINT", () => {
    shutdown();
    process.exit(0);
});

run("server", "npm run server", { stderrLabel: LABELS.server ?? "server" });
run("watch", "npm run watch");
run("templates", "npm run watch:templates");
