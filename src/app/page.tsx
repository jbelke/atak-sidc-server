"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

interface SymbolExample {
  standard: "APP6" | "2525";
  sidc: string;
  description: string;
  formats: readonly ("jpg" | "png" | "svg" | "gif" | "webp" | "avif")[];
}

const EXAMPLES: readonly SymbolExample[] = [
  {
    standard: "APP6",
    sidc: "10133000001207000000",
    description: "Unmanned Surface Vehicle (USV) - APP6",
    formats: ["jpg", "png", "svg", "gif", "webp", "avif"],
  },
  {
    standard: "2525",
    sidc: "10133000001207000000",
    description: "Unmanned Surface Vehicle (USV) - 2525",
    formats: ["jpg", "png", "svg", "gif", "webp", "avif"],
  },
] as const;

interface QuickLink {
  format: "jpg" | "png" | "svg" | "gif" | "webp" | "avif";
  size?: number;
  width?: number;
  height?: number;
  description: string;
}

const QUICK_LINKS: QuickLink[] = [
  { format: "jpg", size: 500, description: "JPG - 500x500" },
  { format: "png", size: 500, description: "PNG - 500x500" },
  { format: "svg", size: 500, description: "SVG - 500x500" },
  { format: "svg", width: 200, description: "SVG - 200px width" },
  { format: "gif", size: 200, description: "GIF - 200x200" },
  { format: "webp", size: 200, description: "WebP - 200x200" },
  { format: "avif", size: 200, description: "AVIF - 200x200" },
];

export default function Home(): JSX.Element {
  // Initialize with empty string to avoid hydration mismatch
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    // Set the URL only after component mounts on client
    const { protocol, host } = window.location;
    setBaseUrl(`${protocol}//${host}`);
  }, []);

  // Don't show the curl commands until we have the baseUrl
  const renderCurlCommand = (example: SymbolExample, format: string) => {
    if (!baseUrl) return null;

    return (
      <code>
        {`curl -H "Accept: image/${format === "svg" ? "svg+xml" : format}" \
  "${baseUrl}/api/${example.standard}/${example.sidc}.${format}?size=100"`}
      </code>
    );
  };

  const renderQuickLink = (format: QuickLink) => {
    if (!baseUrl) return null;

    const params = new URLSearchParams();
    if (format.size) params.set("size", format.size.toString());
    if (format.width) params.set("width", format.width.toString());
    if (format.height) params.set("height", format.height.toString());

    const url = `${baseUrl}/api/APP6/10133000001207000000.${format.format}?${params}`;

    return (
      <div key={format.description} className={styles.quickLink}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={format.description}
            width={format.size || 200}
            height={format.size || 200}
            className={styles.symbolPreview}
          />
          <span>{format.description}</span>
        </a>
      </div>
    );
  };

  return (
    <main className={styles.main}>
      <div className={styles.description}>
        <h1>ATAK SIDC Server</h1>
        <p>
          A high-performance server for generating military symbols using SIDC
          (Symbol Identification Coding Scheme) codes.
        </p>
      </div>

      <div className={styles.center}>
        <h2>API Endpoints</h2>
        <div className={styles.endpoints}>
          <div className={styles.endpoint}>
            <h3>Generate Symbol</h3>
            <code>
              GET /api/{"{standard}"}/{"{sidc}"}
            </code>
            <p>Convert SIDC code to SVG/PNG format</p>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Documentation</h2>
          <p>View the full API documentation and examples.</p>
        </div>

        <div className={styles.card}>
          <h2>Standards</h2>
          <p>Supports multiple military symbol standards.</p>
        </div>

        <div className={styles.card}>
          <h2>High Performance</h2>
          <p>Dual-server setup with PM2 for reliability.</p>
        </div>

        <div className={styles.card}>
          <h2>Docker Ready</h2>
          <p>Easy deployment with Docker and Docker Compose.</p>
        </div>
      </div>

      <div className={styles.content}>
        <h2>Roadmap</h2>
        <div className={styles.roadmapGrid}>
          <div className={styles.roadmapItem}>
            <h3>3D Model Generation</h3>
            <p>
              Coming soon: Generate 3D models (GLTF, GLB, OBJ) from SIDC codes
            </p>
            <ul className={styles.formatList}>
              <li>
                <code>gltf</code> - GL Transmission Format
              </li>
              <li>
                <code>glb</code> - Binary GL Transmission Format
              </li>
              <li>
                <code>obj</code> - Wavefront OBJ Format
              </li>
            </ul>
          </div>
        </div>

        <h2>API Usage</h2>
        <code className={styles.endpoint}>
          GET /api/:standard/:sidc.:extension?width=:width&height=:height
        </code>

        <h3>Parameters:</h3>
        <ul>
          <li>
            <strong>standard:</strong> Symbol standard (APP6 or 2525)
          </li>
          <li>
            <strong>sidc:</strong> 20-digit Symbol ID Code
          </li>
          <li>
            <strong>extension:</strong> Output format:
            <ul className={styles.formatList}>
              <li>
                <code>svg</code> - Scalable Vector Graphics (best for web)
              </li>
              <li>
                <code>png</code> - Portable Network Graphics (lossless with
                transparency)
              </li>
              <li>
                <code>webp</code> - WebP format (modern, efficient compression)
              </li>
              <li>
                <code>avif</code> - AVIF format (next-gen compression, best
                quality/size)
              </li>
              <li>
                <code>jpg/jpeg</code> - JPEG format (lossy, no transparency)
              </li>
              <li>
                <code>gif</code> - GIF format (lossless with transparency)
              </li>
            </ul>
          </li>
          <li>
            <strong>size:</strong> Square dimensions in pixels (optional,
            defaults to 100)
          </li>
          <li>
            <strong>width:</strong> Image width in pixels (optional, overrides
            size)
          </li>
          <li>
            <strong>height:</strong> Image height in pixels (optional, defaults
            to width)
          </li>
        </ul>

        <h3>Format Notes:</h3>
        <ul className={styles.notes}>
          <li>
            <strong>SVG</strong> is recommended for web use as it scales
            perfectly at any size
          </li>
          <li>
            <strong>PNG</strong> provides lossless quality with transparency
            (using maximum compression)
          </li>
          <li>
            <strong>WebP</strong> uses lossless compression with full alpha
            transparency (100% quality)
          </li>
          <li>
            <strong>AVIF</strong> provides next-gen compression while preserving
            transparency (90% quality, lossless)
          </li>
          <li>
            <strong>JPEG</strong> uses white background (no transparency) and
            standard compression
          </li>
          <li>
            <strong>GIF</strong> supports basic transparency but may have lower
            quality
          </li>
          <li>
            All raster formats support custom dimensions and maintain aspect
            ratio
          </li>
        </ul>

        <h3>Best Practices:</h3>
        <ul className={styles.notes}>
          <li>
            Use <strong>SVG</strong> for web applications where scaling is
            important
          </li>
          <li>
            Use <strong>WebP/AVIF</strong> for modern applications needing
            optimal file size
          </li>
          <li>
            Use <strong>PNG</strong> for applications requiring maximum
            compatibility with transparency
          </li>
          <li>
            Use <strong>JPEG</strong> only when transparency is not needed and
            file size is critical
          </li>
        </ul>

        <h3>Supported Standards:</h3>
        <ul>
          <li>
            <strong>APP6:</strong> NATO APP-6(D) Military Symbol Standard
          </li>
          <li>
            <strong>2525:</strong> MIL-STD-2525 Common Warfighting Symbology
          </li>
        </ul>

        <h2>Credits</h2>
        <ul className={styles.credits}>
          <li>
            <strong>Joshua Belke</strong> - Original implementation of military
            symbol rendering engine
          </li>
          <li>
            <strong>NATO Innovation Hub</strong> - Support and collaboration for
            military symbology standardization
          </li>
        </ul>

        <h2>Quick Examples</h2>
        <div className={styles.quickLinks}>
          {QUICK_LINKS.map((link) => renderQuickLink(link))}
        </div>

        <h2>Example Requests</h2>
        {EXAMPLES.map((example, index) => (
          <div key={index} className={styles.example}>
            <p>
              <strong>Description:</strong> {example.description}
            </p>
            <p>
              <strong>SIDC:</strong> {example.sidc}
            </p>
            {example.formats.map((format) => (
              <div key={format} className={styles.exampleUrl}>
                {renderCurlCommand(example, format)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
