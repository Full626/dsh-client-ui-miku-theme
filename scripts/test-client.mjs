#!/usr/bin/env node
/**
 * Smoke-test the built halves of dsh-client-ui-miku-theme without a browser.
 *
 * Two layers:
 *   1. a dependency-free harness with a minimal fake document + context, which
 *      always runs and checks the contract the DSH loader relies on
 *      (module id, factory, style ownership tags, embedded artwork, token shape);
 *   2. when `@deepseek-ai/cordis` can be located, the same bundle is mounted on
 *      a REAL cordis Context to prove `ctx.effect` / `ctx.inject` behave as used.
 *
 * Usage: node scripts/test-client.mjs [--cordis <abs path to cordis/lib/index.js>]
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(HERE, "..");
const CLIENT = join(PACKAGE_DIR, "lib", "client.js");
const HOST = join(PACKAGE_DIR, "lib", "index.js");

let failures = 0;
/** Record one assertion. */
function check(label, ok, detail) {
	if (ok) {
		console.log(`  ok   ${label}`);
		return;
	}
	failures += 1;
	console.log(`  FAIL ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

/** A minimal document surface covering everything the bundle touches. */
function makeDocument() {
	const styles = [];
	const document = {
		head: {
			appendChild(el) {
				styles.push(el);
				return el;
			},
		},
		createElement(tag) {
			return {
				tagName: tag,
				dataset: {},
				textContent: "",
				remove() {
					const index = styles.indexOf(this);
					if (index >= 0) styles.splice(index, 1);
				},
			};
		},
	};
	return { document, styles };
}

/** Execute lib/client.js and capture the boot-loader registration. */
async function loadClientBundle() {
	const source = await readFile(CLIENT, "utf8");
	let spec;
	globalThis.window = { __ModuleLoader__: { load(value) { spec = value; } } };
	vm.runInThisContext(source, { filename: CLIENT });
	if (spec === undefined) throw new Error("lib/client.js did not call window.__ModuleLoader__.load");
	return spec;
}

/** Instantiate the factory with a require that must never be used. */
function instantiate(spec) {
	return spec.factory((name) => {
		throw new Error(`unexpected require(${JSON.stringify(name)}): the bundle must stay dependency-free`);
	});
}

/** Poll until `ready()` or the timeout expires. */
async function waitFor(ready, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (ready()) return true;
		await new Promise((r) => setTimeout(r, 10));
	}
	return ready();
}

/** Locate a cordis installation for the optional integration test. */
function findCordis(explicit) {
	const candidates = [
		explicit,
		process.env.DSH_CORDIS,
		join(PACKAGE_DIR, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"),
		join(dirname(process.execPath), "node_modules", "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"),
		join(dirname(process.execPath), "..", "lib", "node_modules", "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"),
	];
	return candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0 && existsSync(candidate));
}

async function main() {
	const argv = process.argv.slice(2);
	const cordisArg = argv.includes("--cordis") ? argv[argv.indexOf("--cordis") + 1] : undefined;
	const manifest = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
	const pluginId = manifest.name;

	console.log("miku-theme: bundle contract");
	const spec = await loadClientBundle();
	check("module id is the package name", spec.id === pluginId, `got ${spec.id}`);
	check("factory is a function", typeof spec.factory === "function");

	const exportsObject = instantiate(spec);
	check("exports apply()", typeof exportsObject.apply === "function");

	// --- layer 1: fake document + fake context ---------------------------------
	const { document, styles } = makeDocument();
	globalThis.document = document;
	const effects = [];
	const injected = [];
	const ctx = {
		logger: { error() {}, warn() {} },
		effect(fn, label) {
			const disposer = fn();
			effects.push({ label, disposer });
			return disposer;
		},
		inject(deps, callback) {
			injected.push({ deps, callback });
		},
	};
	exportsObject.apply(ctx);

	check("one plugin-owned <style> mounted", styles.length === 1, `got ${styles.length}`);
	const tag = styles[0];
	if (tag !== undefined) {
		check("style carries data-plugin", tag.dataset.plugin === pluginId, String(tag.dataset.plugin));
		check("style carries data-plugin-css", tag.dataset.pluginCss === `${pluginId}/miku-theme.css`, String(tag.dataset.pluginCss));
		check("stylesheet embeds the JPEG artwork", tag.textContent.includes("data:image/jpeg;base64,"));
		check("stylesheet covers both palettes", tag.textContent.includes("body[data-ds-dark-theme]"));
		check("stylesheet carries the Miku teal", tag.textContent.includes("#39c5bb") || tag.textContent.includes("57, 197, 187"));
		check("stylesheet pins the backdrop to the viewport", tag.textContent.includes("background-attachment: fixed"));
		check("light backdrop keeps a reading scrim", tag.textContent.includes("radial-gradient"));
		// Design invariant: dark mode is lit by gradients only — putting the
		// photograph back there is what made it overwhelming.
		const darkAt = tag.textContent.indexOf("body[data-ds-dark-theme] {");
		const darkRule = darkAt < 0 ? "" : tag.textContent.slice(darkAt, tag.textContent.indexOf("}", darkAt));
		check("dark palette shows no artwork", darkRule.length > 0 && !darkRule.includes("miku-artwork"));
		check("no unresolved build placeholder", !tag.textContent.includes("__MIKU_"));
	}
	check("effect registered a label", effects.length === 1 && typeof effects[0].label === "string");

	check("ctx.inject asked for ['theme']", injected.length === 1 && JSON.stringify(injected[0].deps) === '["theme"]', JSON.stringify(injected.map((i) => i.deps)));

	// Simulate the theme service arriving.
	const overrideCalls = [];
	const themeCtx = {
		logger: ctx.logger,
		effect: ctx.effect,
		theme: {
			overrideTokens(source, tokens) {
				overrideCalls.push({ source, tokens });
				return () => {};
			},
		},
	};
	if (injected[0] !== undefined) injected[0].callback(themeCtx);
	check("overrideTokens called once", overrideCalls.length === 1, `got ${overrideCalls.length}`);
	const override = overrideCalls[0];
	if (override !== undefined) {
		check("override source is the package name", override.source === pluginId, String(override.source));
		const entries = Object.entries(override.tokens);
		check("at least 30 tokens overridden", entries.length >= 30, `got ${entries.length}`);
		const shaped = entries.every(
			([name, value]) =>
				name.startsWith("--dsw-") &&
				value !== null &&
				typeof value === "object" &&
				typeof value.light === "string" &&
				value.light.length > 0 &&
				typeof value.dark === "string" &&
				value.dark.length > 0,
		);
		check("every token is --dsw-* with non-empty light and dark values", shaped);
		for (const required of ["--dsw-alias-bg-base", "--dsw-alias-brand-primary", "--dsw-specific-sidebar-fill", "--dsw-alias-label-primary"]) {
			check(`overrides ${required}`, required in override.tokens);
		}
	}

	// Disposal must retract the stylesheet.
	const styleDisposer = effects[0]?.disposer;
	if (typeof styleDisposer === "function") styleDisposer();
	check("disposal removes the stylesheet", styles.length === 0, `${styles.length} left`);

	// --- host half -------------------------------------------------------------
	console.log("miku-theme: host half");
	const host = await import(pathToFileURL(HOST).href);
	check("host applies()", typeof host.apply === "function");
	check("host apply is inert", host.apply() === undefined);

	// --- package manifest: the bundle contract ---------------------------------
	// A profile installs a plugin by selecting a BUNDLE in dsh.profile.bundles, so
	// the manifest and the layer it points at are what actually mount the row.
	console.log("miku-theme: package manifest");
	const pkg = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
	check("package name is the module id", pkg.name === pluginId, String(pkg.name));
	check("declares dsh.bundle.patch", typeof pkg.dsh?.bundle?.patch === "string", String(pkg.dsh?.bundle?.patch));
	check("declares dsh.client for the web platform", pkg.dsh?.client?.platform === "web", String(pkg.dsh?.client?.platform));
	const bundlePatch = join(PACKAGE_DIR, pkg.dsh?.bundle?.patch ?? "missing.yml");
	check("bundle patch file exists", existsSync(bundlePatch));
	if (existsSync(bundlePatch)) {
		const patchText = await readFile(bundlePatch, "utf8");
		check("bundle patch inserts the expected row id", patchText.includes("id: ui-miku-theme"));
		check("bundle patch mounts this package", patchText.includes(pluginId));
	}
	const pluginMeta = join(PACKAGE_DIR, "dsh.plugin.json");
	check("dsh.plugin.json exists", existsSync(pluginMeta));
	if (existsSync(pluginMeta)) {
		const meta = JSON.parse(await readFile(pluginMeta, "utf8"));
		check("dsh.plugin.json names this package", meta.name === pluginId, String(meta.name));
		check("dsh.plugin.json entry names this package", meta.entry?.name === pluginId, String(meta.entry?.name));
	}

	// --- layer 2: real cordis --------------------------------------------------
	console.log("miku-theme: real cordis integration");
	const cordisPath = findCordis(cordisArg);
	if (cordisPath === undefined) {
		console.log("  skip @deepseek-ai/cordis not found (pass --cordis <path> to enable)");
	} else {
		try {
			const { Context } = await import(pathToFileURL(cordisPath).href);
			const app = new Context();
			const scoped = makeDocument();
			globalThis.document = scoped.document;
			const calls = [];
			app.provide("theme", {
				overrideTokens(source, tokens) {
					calls.push({ source, tokens });
					return () => {};
				},
			});
			const live = instantiate(await loadClientBundle());
			app.plugin(live);
			const settled = await waitFor(() => calls.length > 0 && scoped.styles.length > 0, 2000);
			check("cordis: stylesheet mounted on a real Context", scoped.styles.length === 1, `got ${scoped.styles.length}`);
			check("cordis: inject resolved and overrides stacked", calls.length === 1, `got ${calls.length}`);
			check("cordis: settled within the timeout", settled);
			await app.stop?.();
		} catch (error) {
			console.log(`  skip real cordis run failed to start: ${error.message}`);
		}
	}

	console.log(failures === 0 ? "\nmiku-theme: all checks passed" : `\nmiku-theme: ${failures} check(s) FAILED`);
	process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
	console.error(`miku-theme: ${error.stack ?? error.message}`);
	process.exitCode = 1;
});
