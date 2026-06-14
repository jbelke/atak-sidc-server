import { JSDOM } from "jsdom";

let browserGlobalsInstalled = false;

/**
 * Polyfill browser globals required by Three.js loaders/exporters in Node.js.
 */
export function ensureBrowserGlobals(): void {
  if (browserGlobalsInstalled) {
    return;
  }

  const dom = new JSDOM();

  if (typeof globalThis.DOMParser === "undefined") {
    globalThis.DOMParser = dom.window.DOMParser;
  }

  if (typeof globalThis.FileReader === "undefined") {
    globalThis.FileReader = dom.window.FileReader as typeof FileReader;
  }

  browserGlobalsInstalled = true;
}
