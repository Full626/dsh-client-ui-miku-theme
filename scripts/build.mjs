#!/usr/bin/env node
/**
 * Build the browser half of dsh-client-ui-miku-theme.
 *
 * Reads the artwork and `src/client/theme.css`, embeds the image as a JPEG
 * data URI (a plugin bundle cannot reference sibling files — the host serves
 * only the bundle itself), substitutes the template placeholders, and writes
 * `lib/client.js` in the DSH client-module format. Also mirrors
 * `src/index.js` to `lib/index.js` for the node half.
 *
 * Placeholders are asserted to occur exactly where expected: the built
 * artifacts must never contain an unresolved marker, and the stylesheet body
 * must never be duplicated (base64 can contain the CSS/JS comment terminator,
 * so a payload landing inside a comment would silently corrupt the bundle).
 *
 * Usage: node scripts/build.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(HERE, "..");

const ASSET = join(PACKAGE_DIR, "assets", "miku-background.jpg");
const CSS = join(PACKAGE_DIR, "src", "client", "theme.css");
const TEMPLATE = join(PACKAGE_DIR, "src", "client", "bundle.tmpl.js");
const HOST_SRC = join(PACKAGE_DIR, "src", "index.js");

const LIB = join(PACKAGE_DIR, "lib");
const CLIENT_OUT = join(LIB, "client.js");
const HOST_OUT = join(LIB, "index.js");

const BACKGROUND = "@@MIKU_BACKGROUND@@";
const PLUGIN_ID = "@@MIKU_PLUGIN_ID@@";
const CSS_LITERAL = "@@MIKU_CSS_LITERAL@@";

/** Human-readable byte count. */
const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;

/** Count non-overlapping occurrences. */
function occurrences(haystack, needle) {
	return haystack.split(needle).length - 1;
}

/** Fail unless the marker appears exactly `expected` times. */
function expectCount(label, text, marker, expected) {
	const found = occurrences(text, marker);
	if (found !== expected) throw new Error(`${label}: expected ${expected} occurrence(s) of ${marker}, found ${found}`);
}

async function main() {
	const manifest = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
	const pluginId = manifest.name;
	if (typeof pluginId !== "string" || pluginId.length === 0) throw new Error("package.json has no name");

	const jpeg = await readFile(ASSET);
	if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
		throw new Error(`${ASSET} is not a JPEG (expected an FF D8 start-of-image marker)`);
	}
	const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

	// --- stylesheet -----------------------------------------------------------
	let css = await readFile(CSS, "utf8");
	expectCount("theme.css", css, BACKGROUND, 1);
	css = css.replaceAll(BACKGROUND, dataUri);
	if (occurrences(css, BACKGROUND) !== 0) throw new Error("theme.css kept an unresolved background marker");

	// --- browser bundle -------------------------------------------------------
	let bundle = await readFile(TEMPLATE, "utf8");
	expectCount("bundle.tmpl.js", bundle, CSS_LITERAL, 1);
	expectCount("bundle.tmpl.js", bundle, PLUGIN_ID, 2);
	bundle = bundle.replaceAll(CSS_LITERAL, JSON.stringify(css));
	bundle = bundle.replaceAll(PLUGIN_ID, pluginId);
	if (bundle.includes("@@MIKU_")) throw new Error("an unresolved placeholder survived into lib/client.js");

	const host = await readFile(HOST_SRC, "utf8");

	await mkdir(LIB, { recursive: true });
	await writeFile(CLIENT_OUT, bundle, "utf8");
	await writeFile(HOST_OUT, host, "utf8");

	console.log(`miku-theme: artwork ${kb(jpeg.length)} -> data URI ${kb(dataUri.length)} (embedded once)`);
	console.log(`miku-theme: stylesheet ${kb(Buffer.byteLength(css))}`);
	console.log(`miku-theme: wrote ${CLIENT_OUT} (${kb(Buffer.byteLength(bundle))})`);
	console.log(`miku-theme: wrote ${HOST_OUT} (${kb(Buffer.byteLength(host))})`);
}

await main();
