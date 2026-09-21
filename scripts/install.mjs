#!/usr/bin/env node
/**
 * Install (or uninstall) dsh-client-ui-miku-theme for one dsh profile.
 *
 * Two effects, both idempotent:
 *   1. copy this package into <profile>/node_modules/<name>
 *   2. upsert a marked loader row in <profile>/cordis.patch.yml
 *
 * A profile with `patchReload: live` picks the row up without a restart.
 *
 * Usage:
 *   node scripts/install.mjs [--dsh-home <dir>] [--profile web] [--dry-run] [--uninstall]
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(HERE, "..");
const ROW_ID = "ui-miku-theme";
const COPIED = ["package.json", "README.md", "lib", "assets"];

/** Parse `--flag value` / `--flag` arguments. */
function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (!token.startsWith("--")) continue;
		const key = token.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith("--")) {
			out[key] = next;
			i += 1;
		} else {
			out[key] = true;
		}
	}
	return out;
}

/** Stable ASCII prefixes: an earlier marker carried a non-ASCII dash, so the block is matched by prefix. */
const MARKER = "dsh-client-ui-miku-theme";
const BEGIN_PREFIX = `# >>> ${MARKER}`;
const END_PREFIX = `# <<< ${MARKER}`;
const BEGIN = `${BEGIN_PREFIX} (managed by scripts/install.mjs; delete the whole block to uninstall) >>>`;
const END = `${END_PREFIX} <<<`;

/** The loader patch entry this plugin owns. */
function rowBlock(pluginId) {
	return [BEGIN, "- insert:", `    - id: ${ROW_ID}`, `      name: ${pluginId}`, END].join("\n");
}

/** Drop any previously managed block, markers included (matched by prefix). */
function stripManagedBlock(text) {
	const lines = text.split(/\r?\n/);
	const kept = [];
	let inside = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith(BEGIN_PREFIX)) {
			inside = true;
			continue;
		}
		if (trimmed.startsWith(END_PREFIX)) {
			inside = false;
			continue;
		}
		if (!inside) kept.push(line);
	}
	return kept;
}

/**
 * Upsert the loader row into a top-level YAML sequence document.
 * Handles the shipped `[]` form and block sequences; a non-empty flow
 * sequence is rejected with a manual instruction rather than guessed at.
 */
function upsertRow(text, block) {
	const lines = stripManagedBlock(text);
	const significant = lines.map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
	const body = significant.join("\n").trim();
	const blockLines = block.split("\n");

	if (body === "" || body === "[]") {
		const index = lines.findIndex((l) => l.trim() === "[]");
		if (index >= 0) lines.splice(index, 1, ...blockLines);
		else lines.push(...blockLines);
	} else if (body.startsWith("[")) {
		throw new Error(
			"cordis.patch.yml uses a non-empty flow sequence, which this installer will not rewrite.\n" +
				"Add this entry manually:\n\n" +
				block +
				"\n",
		);
	} else {
		lines.push(...blockLines);
	}

	const rendered = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
	return `${rendered}\n`;
}

/** Remove the managed block only, restoring the canonical empty sequence when nothing else remains. */
function removeRow(text) {
	const rendered = stripManagedBlock(text).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
	const significant = rendered
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l !== "" && !l.startsWith("#"));
	if (significant.length === 0) return `${rendered}\n[]\n`.replace(/\n{3,}/g, "\n\n");
	return `${rendered}\n`;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const manifest = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
	const pluginId = manifest.name;

	const dshHome = args["dsh-home"] ?? process.env.DSH_HOME;
	if (typeof dshHome !== "string" || dshHome.length === 0) {
		throw new Error("no dsh home: pass --dsh-home <dir> or set $env:DSH_HOME");
	}
	const profile = typeof args.profile === "string" ? args.profile : "web";
	const dryRun = args["dry-run"] === true;
	const uninstall = args.uninstall === true;

	const profileDir = join(resolve(dshHome), "profiles", profile);
	if (!existsSync(join(profileDir, "package.json"))) {
		throw new Error(`no profile at ${profileDir} (expected a package.json there)`);
	}

	const modulesDir = join(profileDir, "node_modules");
	const target = join(modulesDir, pluginId);
	const patchPath = join(profileDir, "cordis.patch.yml");
	const built = join(PACKAGE_DIR, "lib", "client.js");
	if (!uninstall && !existsSync(built)) {
		throw new Error(`${built} is missing — run 'node scripts/build.mjs' first`);
	}

	const currentPatch = existsSync(patchPath) ? await readFile(patchPath, "utf8") : "[]\n";
	const nextPatch = uninstall ? removeRow(currentPatch) : upsertRow(currentPatch, rowBlock(pluginId));

	console.log(`miku-theme: dsh home   ${resolve(dshHome)}`);
	console.log(`miku-theme: profile    ${profile}`);
	console.log(`miku-theme: package    ${target}`);
	console.log(`miku-theme: patch file ${patchPath}`);

	if (dryRun) {
		console.log("\n--- cordis.patch.yml (planned) ---\n" + nextPatch);
		console.log("dry run: nothing was written");
		return;
	}

	const backupPath = `${patchPath}.miku-backup`;
	if (nextPatch !== currentPatch && !existsSync(backupPath)) {
		// Safety net for a live profile file: keep the state we are about to replace,
		// once — so a later re-run cannot overwrite the pristine copy with our own edit.
		await writeFile(backupPath, currentPatch, "utf8");
	}

	if (uninstall) {
		if (existsSync(target)) await rm(target, { recursive: true, force: true });
		await writeFile(patchPath, nextPatch, "utf8");
		console.log("miku-theme: uninstalled. Refresh the page to return to the default look.");
		return;
	}

	await rm(target, { recursive: true, force: true });
	await mkdir(target, { recursive: true });
	for (const entry of COPIED) {
		const from = join(PACKAGE_DIR, entry);
		if (!existsSync(from)) continue;
		await cp(from, join(target, entry), { recursive: true });
	}
	await writeFile(patchPath, nextPatch, "utf8");

	console.log("miku-theme: installed. A profile with patchReload: live applies it now;");
	console.log("miku-theme: otherwise restart `dsh web`, then refresh the page.");
}

main().catch((error) => {
	console.error(`miku-theme: ${error.message}`);
	process.exitCode = 1;
});
