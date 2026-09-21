/**
 * Template for `lib/client.js` — the browser half of dsh-client-ui-miku-theme.
 *
 * `scripts/build.mjs` substitutes this file's two placeholders (the package
 * name, which is also the browser module id, and a JavaScript string literal
 * holding the compiled stylesheet with the artwork embedded as a JPEG data
 * URI) and writes the result in the DSH client-module format: a lazy-CJS
 * factory registered on the boot loader facade.
 *
 * The placeholders appear ONLY at their substitution sites, never in this
 * comment: base64 payloads can contain a comment terminator, so a payload
 * landing inside a comment would corrupt the bundle.
 *
 * The bundle requires no shared platform module, so the factory never uses its
 * `require` argument.
 */
window.__ModuleLoader__.load({
	id: "@@MIKU_PLUGIN_ID@@",
	factory: (_require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/** This plugin's id: the browser module id, the style-owner tag, and the override-layer source. */
		var PLUGIN_ID = "@@MIKU_PLUGIN_ID@@";
		/** Logical name of the single plugin-owned stylesheet (HMR bookkeeping). */
		var STYLE_NAME = "miku-theme.css";

		/** Compiled stylesheet: the artwork backdrop and the Miku accents. */
		var MIKU_CSS = @@MIKU_CSS_LITERAL@@;

		/**
		 * Alias-token overrides stacked over whichever built-in palette is
		 * active. Both modes are mandatory for every token: the layer is not a
		 * theme of its own, so it must stay legible after an Appearance switch.
		 */
		var MIKU_TOKENS = {
			"--dsw-alias-bg-base": { light: "rgba(250, 252, 252, 0.50)", dark: "rgba(4, 21, 25, 0.58)" },
			"--dsw-alias-bg-layer-1": { light: "rgba(255, 255, 255, 0.82)", dark: "rgba(7, 30, 34, 0.78)" },
			"--dsw-alias-bg-layer-2": { light: "rgba(250, 252, 252, 0.76)", dark: "rgba(9, 36, 40, 0.74)" },
			"--dsw-alias-bg-layer-3": { light: "rgba(246, 250, 250, 0.72)", dark: "rgba(11, 42, 46, 0.70)" },
			"--dsw-alias-bg-overlay": { light: "rgba(250, 253, 253, 0.97)", dark: "rgba(6, 28, 32, 0.97)" },
			"--dsw-alias-bg-module-platform": { light: "rgba(255, 255, 255, 0.78)", dark: "rgba(9, 36, 40, 0.74)" },
			"--dsw-alias-bg-skeleton": { light: "rgba(18, 40, 44, 0.07)", dark: "rgba(57, 197, 187, 0.12)" },
			"--dsw-alias-bg-multi-select": { light: "rgba(57, 197, 187, 0.20)", dark: "rgba(57, 197, 187, 0.22)" },
			"--dsw-alias-bg-mask-photo": { light: "rgba(4, 20, 24, 0.74)", dark: "rgba(2, 12, 15, 0.88)" },
			"--dsw-specific-sidebar-fill": { light: "rgba(246, 251, 251, 0.54)", dark: "rgba(4, 23, 27, 0.78)" },
			"--dsw-alias-brand-primary": { light: "#0f7d77", dark: "#39c5bb" },
			"--dsw-alias-brand-primary-invert": { light: "#39c5bb", dark: "#0a5f5a" },
			"--dsw-alias-brand-text": { light: "#0b6a65", dark: "#7ff0e6" },
			"--dsw-alias-label-primary": { light: "#041f23", dark: "#e8fffd" },
			"--dsw-alias-label-secondary": { light: "#15484a", dark: "#a6d9d6" },
			"--dsw-alias-label-tertiary": { light: "#2b6365", dark: "#7fb9b7" },
			"--dsw-alias-label-caption": { light: "#3a7375", dark: "#6fa8a6" },
			"--dsw-alias-label-dimmed": { light: "rgba(4, 31, 35, 0.52)", dark: "rgba(232, 255, 253, 0.45)" },
			"--dsw-alias-label-primary-dimmed": { light: "rgba(4, 31, 35, 0.68)", dark: "rgba(232, 255, 253, 0.62)" },
			"--dsw-alias-label-primary-inverted": { light: "#e8fffd", dark: "#06272b" },
			"--dsw-alias-link": { light: "#0b6d68", dark: "#6fe3da" },
			"--dsw-alias-border-l1": { light: "rgba(15, 125, 119, 0.14)", dark: "rgba(111, 227, 218, 0.12)" },
			"--dsw-alias-border-l2": { light: "rgba(15, 125, 119, 0.22)", dark: "rgba(111, 227, 218, 0.18)" },
			"--dsw-alias-border-l3": { light: "rgba(15, 125, 119, 0.28)", dark: "rgba(111, 227, 218, 0.24)" },
			"--dsw-alias-border-l4": { light: "rgba(15, 125, 119, 0.36)", dark: "rgba(111, 227, 218, 0.30)" },
			"--dsw-alias-interactive-bg-hover": { light: "rgba(57, 197, 187, 0.16)", dark: "rgba(57, 197, 187, 0.18)" },
			"--dsw-alias-interactive-bg-hover-solid": { light: "rgba(57, 197, 187, 0.24)", dark: "rgba(57, 197, 187, 0.26)" },
			"--dsw-alias-interactive-bg-hover-accent": { light: "rgba(57, 197, 187, 0.20)", dark: "rgba(57, 197, 187, 0.22)" },
			"--dsw-alias-interactive-bg-active": { light: "rgba(57, 197, 187, 0.30)", dark: "rgba(57, 197, 187, 0.32)" },
			"--dsw-alias-button-primary-fill": { light: "#0f7d77", dark: "#39c5bb" },
			"--dsw-alias-button-primary-hover": { light: "#0b655f", dark: "#54d8cd" },
			"--dsw-alias-button-primary-dimmed": { light: "rgba(15, 125, 119, 0.45)", dark: "rgba(57, 197, 187, 0.45)" },
			"--dsw-alias-button-info-fill": { light: "rgba(57, 197, 187, 0.16)", dark: "rgba(57, 197, 187, 0.18)" },
			"--dsw-alias-button-info-hover": { light: "rgba(57, 197, 187, 0.26)", dark: "rgba(57, 197, 187, 0.28)" },
			"--dsw-alias-markdown-code-block": { light: "rgba(15, 34, 36, 0.08)", dark: "rgba(2, 17, 21, 0.72)" },
			"--dsw-alias-markdown-code-block-banner": { light: "rgba(15, 34, 36, 0.11)", dark: "rgba(4, 26, 30, 0.78)" },
			"--dsw-alias-markdown-inline-code": { light: "rgba(15, 34, 36, 0.10)", dark: "rgba(57, 197, 187, 0.16)" },
			"--dsw-alias-markdown-tag": { light: "rgba(57, 197, 187, 0.22)", dark: "rgba(57, 197, 187, 0.24)" },
			"--dsw-alias-markdown-citation": { light: "rgba(57, 197, 187, 0.20)", dark: "rgba(57, 197, 187, 0.22)" },
			"--dsw-alias-markdown-placeholder": { light: "rgba(6, 39, 43, 0.35)", dark: "rgba(232, 255, 253, 0.35)" },
			"--dsw-alias-scrollbar-bg-l1": { light: "rgba(15, 125, 119, 0.30)", dark: "rgba(57, 197, 187, 0.30)" },
			"--dsw-alias-scrollbar-hover-l1": { light: "rgba(15, 125, 119, 0.55)", dark: "rgba(57, 197, 187, 0.55)" },
			"--dsw-alias-scrollbar-bg-l2": { light: "rgba(15, 125, 119, 0.26)", dark: "rgba(57, 197, 187, 0.26)" },
			"--dsw-alias-scrollbar-hover-l2": { light: "rgba(15, 125, 119, 0.50)", dark: "rgba(57, 197, 187, 0.50)" },
			"--dsw-alias-tooltip-bg": { light: "rgba(6, 39, 43, 0.94)", dark: "rgba(4, 24, 28, 0.96)" },
			"--dsw-alias-toast-bg": { light: "rgba(238, 253, 252, 0.97)", dark: "rgba(6, 28, 32, 0.97)" }
		};

		/**
		 * Mount the plugin-owned stylesheet for exactly this plugin's lifetime.
		 * The owner tags let the module loader inventory and HMR remove it.
		 *
		 * @param ctx - the client plugin context.
		 */
		function installStylesheet(ctx) {
			if (typeof document === "undefined") return;
			ctx.effect(() => {
				var tag = document.createElement("style");
				tag.dataset.plugin = PLUGIN_ID;
				tag.dataset.pluginCss = PLUGIN_ID + "/" + STYLE_NAME;
				tag.textContent = MIKU_CSS;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, "miku-theme: artwork backdrop and accents");
		}

		/**
		 * Stack the alias-token layer once the theme service exists. The theme
		 * service projects snapshot tokens inline on <body>, so a stylesheet
		 * rule could not win; this registry layer is the supported channel.
		 *
		 * @param ctx - the client plugin context.
		 */
		function installTokenOverrides(ctx) {
			var stack = (themeCtx) => {
				themeCtx.effect(() => themeCtx.theme.overrideTokens(PLUGIN_ID, MIKU_TOKENS), "miku-theme: --dsw-* alias-token overrides");
			};
			if (typeof ctx.inject === "function") ctx.inject(["theme"], stack);
			else if (ctx.theme !== void 0) stack(ctx);
		}

		/**
		 * Client plugin body: paint the skin, then stack the token overrides.
		 * A failure stays local — a broken skin must never keep the GUI from booting.
		 *
		 * @param ctx - the client plugin context.
		 */
		function apply(ctx) {
			try {
				installStylesheet(ctx);
				installTokenOverrides(ctx);
			} catch (error) {
				(ctx.logger ?? console).error("miku-theme: failed to install the Hatsune Miku skin", error);
			}
		}

		exports.apply = apply;
		return module.exports;
	}
});
