#!/usr/bin/env node
/**
 * Ask a running `dsh web` server whether this plugin's browser half is published.
 *
 * The index page answers only to a request carrying the launch token, so this
 * check uses the HMR event channel instead: `GET <url>/plugins/events` is a
 * server-sent-events stream whose first frame is the current client-module
 * graph (the same object served as `window.__DSH_BOOT__`). That graph carries
 * one entry per published browser plugin, so finding this package's id proves
 * the live composition picked the profile patch up.
 *
 * Usage: node scripts/check-live.mjs [--url http://127.0.0.1:3080] [--timeout 6000]
 */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(HERE, "..");

/** Read `--name value`, falling back to a default. */
function arg(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

const url = arg("url", process.env.DSH_WEB_URL ?? "http://127.0.0.1:3080");
const timeoutMs = Number(arg("timeout", "6000"));

/** Read the first `graph` frame from the HMR event channel. */
async function readGraph() {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(new URL("/plugins/events", url), {
			headers: { accept: "text/event-stream" },
			signal: controller.signal,
		});
		if (!response.ok) throw new Error(`GET /plugins/events -> ${response.status}`);
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			for (const frame of buffer.split("\n\n")) {
				const line = frame.split("\n").find((candidate) => candidate.startsWith("data:"));
				if (line === undefined) continue;
				let payload;
				try {
					payload = JSON.parse(line.slice(5).trim());
				} catch {
					continue;
				}
				if (payload.type === "graph") {
					await reader.cancel();
					return payload.graph;
				}
			}
		}
		throw new Error("the HMR channel closed before sending a graph frame");
	} finally {
		clearTimeout(timer);
	}
}

const manifest = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
const pluginId = manifest.name;

try {
	const graph = await readGraph();
	const entries = Array.isArray(graph?.entries) ? graph.entries : [];
	const matches = entries.filter((entry) => entry?.id === pluginId);
	const found = matches[0];
	console.log(`miku-theme: live graph rev ${graph?.rev ?? "(unknown)"} with ${entries.length} browser entries`);
	if (matches.length > 1) {
		console.log(`miku-theme: DUPLICATED — the profile patch declares "${pluginId}" ${matches.length} times.`);
		process.exitCode = 1;
	} else if (found === undefined) {
		console.log(`miku-theme: NOT published — "${pluginId}" is absent from the live graph.`);
		console.log("miku-theme: restart \`dsh web\` — the live patch reload did not pick the row up.");
		process.exitCode = 1;
	} else {
		console.log(`miku-theme: published — ${JSON.stringify(found)}`);
		const response = await fetch(new URL(found.url, url));
		const body = await response.text();
		const kb = (body.length / 1024).toFixed(1);
		console.log(`miku-theme: served bundle ${response.status} ${response.headers.get("content-type")} ${kb} KiB`);
		const required = ["__ModuleLoader__.load", pluginId, "data:image/jpeg;base64,", "background-attachment: fixed"];
		for (const needle of required) console.log(`miku-theme:   ${body.includes(needle) ? "ok  " : "MISS"} ${needle}`);
		if (!required.every((needle) => body.includes(needle))) process.exitCode = 1;
	}
} catch (error) {
	console.error(`miku-theme: could not read the live graph from ${url}: ${error.message}`);
	process.exitCode = 1;
}
