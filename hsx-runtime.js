// hsx-runtime.js — HSX v0.64 Core (Full Custom HSX + Media + Security + Browser-Native)
// © 2026 William Isaiah Jones

export class HSXRuntime {
  constructor() {
    this.components = {};
    this.context = {};
    this.pyodide = null;
    this.sandboxed = true; // sandbox mode for HSX blocks
  }

  // Initialize Python engine
  async initPyodide() {
    if (!this.pyodide) {
      console.log("🐍 Initializing Pyodide...");
      try {
        const { loadPyodide } = await import("./pyodide/pyodide.mjs");
        this.pyodide = await loadPyodide({ indexURL: "./pyodide/" });
      } catch (e) {
        console.warn("⚠️ Pyodide not available; Python blocks will be skipped.");
      }
    }
  }

  // Load HSX files (supports single or multiple)
  async loadFiles(filePaths) {
    if (!Array.isArray(filePaths)) filePaths = [filePaths];
    for (const path of filePaths) await this.load(path);
  }

  // Load HSX via HTTP or local path
  async load(filePath) {
    console.log(`🌀 Loading HSX file: ${filePath}`);
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const code = await response.text();
      await this.execute(code);
    } catch (e) {
      console.error(`❌ Failed to load HSX file: ${filePath}`, e);
    }
  }

  // Execute HSX code
  async execute(code) {
    const lines = code.split("\n").map(l => l.trimEnd());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // === Media ===
      if (line.startsWith("hsx attach image")) {
        const match = line.match(/"(.*?)"/);
        if (match) this._attachMedia("img", match[1]);
        continue;
      }
      if (line.startsWith("hsx attach video")) {
        const match = line.match(/"(.*?)"/);
        if (match) this._attachMedia("video", match[1]);
        continue;
      }
      if (line.startsWith("hsx attach audio")) {
        const match = line.match(/"(.*?)"/);
        if (match) this._attachMedia("audio", match[1]);
        continue;
      }

      // === Components ===
      if (line.startsWith("hsx define component")) {
        const name = line.replace("hsx define component", "").trim();
        let body = "";
        i++;
        while (i < lines.length && !lines[i].startsWith("hsx end")) {
          body += lines[i] + "\n";
          i++;
        }
        this.components[name] = body;
        console.log(`🧩 Component defined: ${name}`);
        continue;
      }

      if (line.startsWith("hsx render")) {
        const comp = line.replace("hsx render", "").trim();
        this._renderComponent(comp);
        continue;
      }

// === JS Blocks ===
if (line.startsWith("{js")) {
  let jsCode = "";
  i++;
  while (i < lines.length && !lines[i].match(/^}\s*$/)) {
    jsCode += lines[i] + "\n";
    i++;
  }
  jsCode = jsCode.trim();

  if (jsCode) {
    try {
      // DOM-ready wrapper for safety (no nested try/catch conflict)
      new Function(`
        document.addEventListener('DOMContentLoaded', async () => {
          try {
            const __result = (async () => { ${jsCode} })();
            if (__result?.catch) {
              __result.catch(err => console.error('❌ JS error:', err));
            }
          } catch (err) {
            console.error('❌ JS error:', err);
          }
        });
      `)();

      console.log("💻 JS block executed (DOM safe).");
    } catch (e) {
      console.error("❌ JS block error:", e, "\nCode:\n", jsCode);
    }
  }
  continue;
}

      // === Python Blocks ===
      if (line.startsWith("{py")) {
        let pyCode = "";
        i++;
        while (i < lines.length && !lines[i].match(/^}\s*$/)) {
          pyCode += lines[i] + "\n";
          i++;
        }
        if (this.pyodide) {
          try {
            await this.pyodide.runPythonAsync(pyCode);
            console.log("🐍 Python block executed.");
          } catch (e) {
            console.error("❌ Python error:", e, "\nCode:\n", pyCode);
          }
        } else {
          console.warn("⚠️ Skipping Python block (Pyodide not loaded).");
        }
        continue;
      }

      // === Native HSX Blocks ===
      if (line.startsWith("{hsx")) {
        let hsxCode = "";
        i++;
        while (i < lines.length && !lines[i].match(/^}\s*$/)) {
          hsxCode += lines[i] + "\n";
          i++;
        }
        await this._runHSXBlock(hsxCode);
        continue;
      }

      // === Security Mode ===
      if (line.startsWith("hsx security")) {
        const mode = line.replace("hsx security", "").trim();
        this.sandboxed = mode !== "off";
        console.log(`🔒 HSX security mode: ${this.sandboxed ? "ON" : "OFF"}`);
        continue;
      }
    }

    console.log("✅ HSX execution complete!");
  }

  // ===== Helper Methods =====
  _attachMedia(type, src) {
    const el = document.createElement(type);
    el.src = src;
    if (type === "video" || type === "audio") el.controls = true;
    if (type === "img") el.style.width = "400px";
    document.body.appendChild(el);
    console.log(`📎 Attached ${type}: ${src}`);
  }

  _renderComponent(name) {
    if (!this.components[name]) {
      console.warn(`⚠️ Component not found: ${name}`);
      return;
    }
    const el = document.createElement("div");
    el.innerHTML = this.components[name];
    document.body.appendChild(el);
    console.log(`✨ Rendered component: ${name}`);
  }

  async _runHSXBlock(code) {
    if (this.sandboxed) {
      try {
        // Placeholder for future HSX interpreter
        console.log("🌀 Running HSX block:\n", code);
      } catch (e) {
        console.error("❌ HSX block error:", e);
      }
    } else {
      console.log("⚠️ HSX block skipped (sandbox off).");
    }
  }

  // === Browser-native execution ===
  async loadFromFile(file) {
    const text = await file.text();
    await this.execute(text);
  }

  async loadFromText(text) {
    await this.execute(text);
  }
}

// === Global auto-init for browser-native use ===
window.HSXRuntime = HSXRuntime;

// === Drag-and-drop support for local HSX files ===
window.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.createElement("div");
  dropZone.innerText = "📂 Drop HSX files here";
  dropZone.style.border = "2px dashed #666";
  dropZone.style.padding = "20px";
  dropZone.style.margin = "20px";
  dropZone.style.textAlign = "center";
  document.body.appendChild(dropZone);

  dropZone.addEventListener("dragover", e => e.preventDefault());
  dropZone.addEventListener("drop", async e => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) {
      if (file.name.endsWith(".hsx")) {
        const hsx = new HSXRuntime();
        await hsx.loadFromFile(file);
      }
    }
  });
});

// === Auto-load via URL or .hsx file path (kept from v0.61) ===
if (location.search.includes("hsxFiles=")) {
  const filesParam = new URLSearchParams(location.search).get("hsxFiles");
  const files = filesParam.split(",");
  const hsx = new HSXRuntime();
  hsx.loadFiles(files);
} else if (location.pathname.endsWith(".hsx")) {
  const hsx = new HSXRuntime();
  hsx.load(location.pathname);
}

