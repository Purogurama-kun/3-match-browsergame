const { execSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const directoriesToCopy = ["assets", "backend", "css", "dist", "html"];
const filesToCopy = ["index.html", "manifest.webmanifest", "service-worker.js"];

function run(command) {
    execSync(command, { cwd: rootDir, stdio: "inherit" });
}

async function copyReleaseFiles() {
    await fs.rm(publicDir, { recursive: true, force: true });
    await fs.mkdir(publicDir, { recursive: true });

    await Promise.all(
        directoriesToCopy.map((directory) =>
            fs.cp(
                path.join(rootDir, directory),
                path.join(publicDir, directory),
                { recursive: true }
            )
        )
    );

    await Promise.all(
        filesToCopy.map((file) =>
            fs.copyFile(path.join(rootDir, file), path.join(publicDir, file))
        )
    );
}

async function main() {
    run("npm run render");
    run("npm run build");
    await copyReleaseFiles();
}

main().catch((error) => {
    console.error("Publish failed:", error);
    process.exit(1);
});
