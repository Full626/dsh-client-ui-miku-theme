#!/usr/bin/env node
/**
 * Install (or uninstall) dsh-client-ui-miku-theme for one dsh profile.
 *
 * This package is a dsh **bundle**: it ships `cordis.patch.yml`, which the
 * profile loader applies by itself once the package name is selected in the
 * profile's `dsh.profile.bundles`. So this installer only does two things,
 * both idempotent:
 *
 *   1. put the package where the profile resolves it
 *      (<profile>/node_modules/<name>)
 *   2. append <name> to <profile>/package.json -> dsh.profile.bundles
 *
 * It never edits cordis.patch.yml. An earlier release inserted a loader row
 * there directly; any such managed block is stripped on the way through, so
 * re-installing cannot mount the plugin twice.
 *
 * These routes keep pnpm's install state authoritative and are preferable when
 * you have network access (this script is the offline / manual fallback):
 *   desktop app : sidebar -> Plugins -> install, then paste the GitHub URL
 *   any profile : dsh plugin --profile <name> add <github spec>
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
/** Everything a profile needs at runtime; src/ and scripts/ stay behind. */
const COPIED = ["package.json", "cordis.patch.yml", "dsh.plugin.json", "LICENSE", "CREDITS.md", "README.md", "lib", "assets"];

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

/** Stable ASCII prefixes of the legacy loader-row block this installer used to write. */
const MARKER = "dsh-client-ui-miku-theme";
const BEGIN_PREFIX = `# >>> ${MARKER}`;
const END_PREFIX = `# <<< ${MARKER}`;

/** Drop a legacy managed block from a profile patch file, markers included. */
function stripLegacyBlock(text) {
	const kept = [];
	let inside = false;
	for (const line of text.split(/\r?\n/)) {
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
	return kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const manifest = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
	const pluginId = manifest.name;
	if (manifest.dsh?.bundle?.patch === undefined) {
		throw new Error("package.json has no dsh.bundle.patch, so this package is not a bundle");
	}

	const dshHome = args["dsh-home"] ?? process.env.DSH_HOME;
	if (typeof dshHome !== "string" || dshHome.length === 0) {
		throw new Error("no dsh home: pass --dsh-home <dir> or set $env:DSH_HOME");
	}
	// The desktop app already names the profile it booted in these variables.
	const profile = typeof args.profile === "string" ? args.profile : process.env.DSH_PROFILE ?? "web";
	const dryRun = args["dry-run"] === true;
	const uninstall = args.uninstall === true;

	const profileDir = join(resolve(dshHome), "profiles", profile);
	const profileManifestPath = join(profileDir, "package.json");
	if (!existsSync(profileManifestPath)) {
		throw new Error(`no profile at ${profileDir} (expected a package.json there)`);
	}

	const target = join(profileDir, "node_modules", pluginId);
	const patchPath = join(profileDir, "cordis.patch.yml");
	const built = join(PACKAGE_DIR, "lib", "client.js");
	if (!uninstall && !existsSync(built)) {
		throw new Error(`${built} is missing; run 'node scripts/build.mjs' first`);
	}

	const originalManifestText = await readFile(profileManifestPath, "utf8");
	const profileManifest = JSON.parse(originalManifestText);
	profileManifest.dsh ??= {};
	profileManifest.dsh.profile ??= {};
	const bundles = Array.isArray(profileManifest.dsh.profile.bundles) ? profileManifest.dsh.profile.bundles : [];
	const nextBundles = uninstall
		? bundles.filter((name) => name !== pluginId)
		: bundles.includes(pluginId)
			? bundles
			: [...bundles, pluginId];
	profileManifest.dsh.profile.bundles = nextBundles;
	const nextManifest = `${JSON.stringify(profileManifest, void 0, 2)}\n`;

	const patchText = existsSync(patchPath) ? await readFile(patchPath, "utf8") : "";
	const strippedPatch = patchText === "" ? undefined : `${stripLegacyBlock(patchText)}\n`;
	const patchChanges = strippedPatch !== undefined && strippedPatch !== patchText;

	console.log(`miku-theme: dsh home  ${resolve(dshHome)}`);
	console.log(`miku-theme: profile   ${profile}`);
	console.log(`miku-theme: package   ${target}`);
	console.log(`miku-theme: bundles   [${bundles.join(", ")}] -> [${nextBundles.join(", ")}]`);
	if (patchChanges) {
		console.log("miku-theme: legacy loader row found in cordis.patch.yml; removing it (the bundle supplies the row now)");
	}

	if (dryRun) {
		console.log("\n--- <profile>/package.json (planned) ---");
		console.log(JSON.stringify({ dsh: { profile: { bundles: nextBundles } } }, void 0, 2));
		if (patchChanges) console.log("\n--- cordis.patch.yml (planned) ---\n" + strippedPatch);
		console.log("dry run: nothing was written");
		return;
	}

	const backupPath = `${profileManifestPath}.miku-backup`;
	if (nextManifest !== originalManifestText && !existsSync(backupPath)) {
		// Safety net for a live profile file: keep the state we replace, once, so a
		// later re-run cannot overwrite the pristine copy with our own edit.
		await writeFile(backupPath, originalManifestText, "utf8");
	}

	if (uninstall) {
		if (existsSync(target)) await rm(target, { recursive: true, force: true });
		await writeFile(profileManifestPath, nextManifest, "utf8");
		if (patchChanges) await writeFile(patchPath, strippedPatch, "utf8");
		console.log("miku-theme: uninstalled. Restart the app so the profile composes without it.");
		return;
	}

	await rm(target, { recursive: true, force: true });
	await mkdir(target, { recursive: true });
	for (const entry of COPIED) {
		const from = join(PACKAGE_DIR, entry);
		if (!existsSync(from)) continue;
		await cp(from, join(target, entry), { recursive: true });
	}
	await writeFile(profileManifestPath, nextManifest, "utf8");
	if (patchChanges) await writeFile(patchPath, strippedPatch, "utf8");

	console.log("miku-theme: installed as a bundle.");
	console.log("miku-theme: restart the app so the new bundle layer is composed, then refresh the view.");
}

main().catch((error) => {
	console.error(`miku-theme: ${error.message}`);
	process.exitCode = 1;
});
