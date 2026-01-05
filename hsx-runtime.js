// hsx-runtime.js — HSX v0.66+ Core (Full Interpreter + Modules + Fun + Attachments + Legacy Safety)
// © 2026 William Isaiah Jones

export class HSXRuntime {
  constructor() {
    this.components = {};
    this.context = {};
    this.modules = {};       // Loaded modules (.ps, .ks)
    this.attachments = {};   // Media/audio/rec attachments
    this.pyodide = null;
    this.sandboxed = true;   // Sandbox mode for HSX blocks
  }

  // === Python engine init ===
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

  // === Load HSX files ===
  async loadFiles(filePaths) {
    if (!Array.isArray(filePaths)) filePaths = [filePaths];
    for (const path of filePaths) await this.load(path);
  }

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

  // === Execute HSX code ===
  async execute(code) {
    const lines = code.split("\n").map(l => l.trimEnd());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // === Media ===
      if (line.startsWith("hsx attach image")) { this._attachMedia("img", this._extractQuotes(line)); continue; }
      if (line.startsWith("hsx attach video")) { this._attachMedia("video", this._extractQuotes(line)); continue; }
      if (line.startsWith("hsx attach audio")) { this._attachMedia("audio", this._extractQuotes(line)); continue; }

      // === Components ===
      if (line.startsWith("hsx define component")) {
        const name = line.replace("hsx define component", "").trim();
        let body = "";
        i++;
        while (i < lines.length && !lines[i].startsWith("hsx end")) { body += lines[i] + "\n"; i++; }
        this.components[name] = body;
        console.log(`🧩 Component defined: ${name}`);
        continue;
      }
      if (line.startsWith("hsx render")) { this._renderComponent(line.replace("hsx render", "").trim()); continue; }

      // === JS / Python / HSX blocks ===
      if (line.startsWith("{js") || line.startsWith("{py") || line.startsWith("{hsx")) {
        let block = "";
        const type = line.slice(1, 3); // "js", "py", "hsx"
        i++;
        while (i < lines.length && !lines[i].match(/^}\s*$/)) { block += lines[i] + "\n"; i++; }
        if (type === "js") await this._runJS(block, true);  // DOM-safe by default
        else if (type === "py") await this._runPy(block);
        else if (type === "hsx") await this._runHSXBlock(block);
        continue;
      }

      // === Security mode ===
      if (line.startsWith("hsx security")) {
        this.sandboxed = line.replace("hsx security", "").trim() !== "off";
        console.log(`🔒 HSX security mode: ${this.sandboxed ? "ON" : "OFF"}`);
        continue;
      }

      // === Module commands ===
      if (line.startsWith("hsx modules:")) { await this._handleModules(line.replace("hsx modules:", "").trim()); continue; }

      // === Meta / Fun ===
      if (line.startsWith("hsx:")) { await this._handleMeta(line.replace("hsx:", "").trim()); continue; }

      // === Other ===
      console.log(`ℹ️ HSX meta line: ${line}`);
    }
    console.log("✅ HSX execution complete!");
  }

  // === Helpers ===
  _extractQuotes(str) { const m = str.match(/"(.*?)"/); return m ? m[1] : ""; }

  _attachMedia(type, src) {
    const el = document.createElement(type);
    el.src = src;
    if (type === "video" || type === "audio") el.controls = true;
    if (type === "img") el.style.width = "400px";
    document.body.appendChild(el);
    console.log(`📎 Attached ${type}: ${src}`);
  }

  _renderComponent(name) {
    if (!this.components[name]) return console.warn(`⚠️ Component not found: ${name}`);
    const el = document.createElement("div");
    el.innerHTML = this.components[name];
    document.body.appendChild(el);
    console.log(`✨ Rendered component: ${name}`);
  }

  // === JS / Python runners ===
  async _runJS(code, domSafe = false) {
    try {
      if (domSafe) {
        // Legacy behavior: wrap in DOMContentLoaded for safety
        new Function(`
          document.addEventListener('DOMContentLoaded', () => {
            try { ${code} } catch(e) { console.error('❌ JS error:', e); }
          });
        `)();
      } else {
        new Function(code)();
      }
      console.log("💻 JS executed");
    } catch(e){ console.error("❌ JS error:", e);}
  }
  async _runPy(code) { if (this.pyodide) try { await this.pyodide.runPythonAsync(code); console.log("🐍 Python executed"); } catch(e){ console.error("❌ Python error:", e);} }

  // === HSX interpreter ===
  async _runHSXBlock(code) {
    if (!this.sandboxed) { console.warn("⚠️ HSX block skipped (sandbox off)"); return; }
    const lines = code.split("\n").map(l => l.trim());
    for (let line of lines) {
      if (!line) continue;

      // === Module execution ===
      if (line.endsWith(".ps") || line.endsWith(".ks")) { await this._runModule(line.trim()); continue; }

      // === Attachments (keep old '-' and ',' parsing) ===
      if (line.includes("eq") || line.includes("-") || line.includes(",")) { this._parseAttachmentLegacy(line); continue; }

      // === Fun mode ===
      if (line.startsWith("hsx:fun")) { await this._runFun(line.replace("hsx:fun","").trim()); continue; }

      // === Inline JS / Py code ===
      if (line.startsWith("{js")) await this._runJS(line.replace("{js","").replace("}","").trim());
      else if (line.startsWith("{py")) await this._runPy(line.replace("{py","").replace("}","").trim());
    }
  }

  // === Attachments parser (legacy + comma support) ===
  _parseAttachmentLegacy(line) {
    const key = line.split("eq")[0].replace("hsx:new","").trim();
    let val = [];
    if (line.includes(",")) val = line.split("eq")[1].split(",").map(v=>v.trim());
    else val = line.split(/eq|-/).slice(1).map(v=>v.trim()); // fallback to old '-' style
    this.attachments[key] = val;
    console.log("📎 Attachment stored:", key, this.attachments[key]);
  }

  // === Modules ===
  async _runModule(name) {
    if (this.modules[name]) { 
      try { await this.modules[name](); console.log(`📦 Module executed: ${name}`); } 
      catch(e){ console.error("❌ Module error:", e);} 
    } else console.warn(`⚠️ Module not found: ${name}`);
  }

  async _handleModules(cmd) {
    if (cmd.startsWith("Load")) return console.log("📦 Modules loaded");
    if (cmd.startsWith("create")) {
      const name = cmd.split(">")[1]?.trim();
      if (name) this.modules[name] = async () => console.log(`📦 Module ${name} executed`);
    }
    if (cmd.startsWith("comb eq")) {
      const mods = cmd.split("eq")[1].split("+").map(m=>m.trim());
      this.modules[mods.join("+")] = async () => { for (let m of mods) await this._runModule(m); console.log(`📦 Combined modules executed: ${mods.join("+")}`); }
    }
  }

  // === Fun mode ===
  async _runFun(code) {
    console.log("🌀 Fun mode running...");
    const lines = code.split(/[\n;]/).map(l=>l.trim()).filter(Boolean);
    for (let line of lines) {
      if (!line) continue;
      if (line.endsWith(".ps") || line.endsWith(".ks")) await this._runModule(line);
      else if (line.startsWith("{js")) await this._runJS(line.replace("{js","").replace("}","").trim());
      else if (line.startsWith("{py")) await this._runPy(line.replace("{py","").replace("}","").trim());
      else {
        // Legacy fallback: eval anything left (raw JS)
        try { new Function(line)(); console.log("🌀 Fun fallback executed:", line); } catch(e){ console.error("❌ Fun fallback error:", e);}
      }
    }
  }

  async _handleMeta(meta) { console.log("ℹ️ HSX meta:", meta); }

  // === Browser-native execution ===
  async loadFromFile(file) { await this.execute(await file.text()); }
  async loadFromText(text) { await this.execute(text); }
}

// === Auto-init ===
window.HSXRuntime = HSXRuntime;

// === Drag-and-drop ===
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
    for (const file of e.dataTransfer.files) if (file.name.endsWith(".hsx")) { const hsx = new HSXRuntime(); await hsx.loadFromFile(file); }
  });
});

// === Auto-load ===
if (location.search.includes("hsxFiles=")) {
  const filesParam = new URLSearchParams(location.search).get("hsxFiles");
  const files = filesParam.split(",");
  const hsx = new HSXRuntime();
  hsx.loadFiles(files);
} else if (location.pathname.endsWith(".hsx")) {
  const hsx = new HSXRuntime();
  hsx.load(location.pathname);
}
