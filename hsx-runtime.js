// hsx-runtime-full.js — HSX v0.69+ HSXEngine Full Integration
// © 2026 William Isaiah Jones + HSXEngine integration

export class HSXRuntime {
  constructor() {
    // Original HSXRuntime fields
    this.components = {};
    this.context = {};
    this.blocks = {};
    this.data = {};
    this.modules = {};
    this.attachments = {};
    this.metaTags = {};
    this.emotions = {};
    this.pyodide = null;
    this.sandboxed = true;

    this.emotionActive = false;
    this.dataExportActive = false;
    this.metaActive = false;

    // HSXEngine fields
    this.botsDB = {};
    this.customDatabaseBlocks = {};

    this.storages = {};
    this.physicStorage = {};
    this.customStorages = {};

    this.customCodeLines = {};
  }

  // ---------------- HSXEngine Methods ----------------
  embedPhysic(storageName) {
    this.physicStorage[storageName] = this.storages[storageName];
    Object.defineProperty(this, `_physic_${storageName}`, {
      value: this.storages[storageName],
      writable: true,
      enumerable: false
    });
  }

  createCustomStorage(name) {
    this.customStorages[name] ??= {};
    return this.customStorages[name];
  }

  runHSXEngineLine(line, lines, index) {
    // Bots database
    if (line === "bots:") {
      this.botsDB.records ??= [];
      index++;
      while (lines[index]?.trim().startsWith(";:")) {
        const raw = lines[index].replace(";:", "").trim();
        const [name, bot, meta] = raw.split(",").map(v => v.trim());
        this.botsDB.records.push({ name, bot, meta, formats: {} });
        index++;
      }
      return index - 1;
    }

    // HSX storage blocks
    if (line === ":Hsx:") {
      index++;
      let next = lines[index]?.trim();

      if (!next) return index;

      // Physic storage
      if (next.startsWith("$")) {
        const storageName = next.replace("$", "").trim();
        this.storages[storageName] ??= {};
        index++;
        while (lines[index]?.includes("=")) {
          let [k, v] = lines[index].split("=").map(x => x.trim());
          this.storages[storageName][k] = v.replace(/"/g, "");
          index++;
        }
        this.embedPhysic(storageName);
      }
      // Custom storage
      else if (next.startsWith("create storage")) {
        const storageName = next.split(" ").slice(2).join(" ").trim();
        this.createCustomStorage(storageName);
        index++;
        while (lines[index]?.includes("=")) {
          let [k, v] = lines[index].split("=").map(x => x.trim());
          this.customStorages[storageName][k] = v.replace(/"/g, "");
          index++;
        }
      }
      // Custom database block
      else if (next.endsWith(":") && !next.startsWith("$")) {
        const dbName = next.replace(":", "");
        this.customDatabaseBlocks[dbName] ??= [];
        index++;
        while (lines[index]?.trim().startsWith(";:")) {
          this.customDatabaseBlocks[dbName].push(lines[index].replace(";:", "").trim());
          index++;
        }
      }
      return index - 1;
    }

    // CCCL Custom code lines
    if (line.startsWith("CCCL")) {
      const name = line.split(" ")[1];
      index++;
      let block = [];
      while (lines[index]?.trim() !== "}") {
        block.push(lines[index]);
        index++;
      }
      this.customCodeLines[name] = block.join("\n");
      return index;
    }

    // Execute custom code lines
    if (this.customCodeLines[line]) {
      const block = this.customCodeLines[line];
      const subLines = block.split("\n");
      let subIndex = 0;
      while (subIndex < subLines.length) {
        subIndex = this.runHSXEngineLine(subLines[subIndex].trim(), subLines, subIndex) + 1;
      }
    }

    return index;
  }

  runHSXEngine(code) {
    const lines = code.split("\n").map(l => l.trim());
    for (let i = 0; i < lines.length; i++) {
      i = this.runHSXEngineLine(lines[i], lines, i);
    }
  }

  // ---------------- Original HSXRuntime Methods ----------------
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
      this.runHSXEngine(code); // Run HSXEngine features
    } catch (e) {
      console.error(`❌ Failed to load HSX file: ${filePath}`, e);
    }
  }

  async execute(code) {
    const lines = code.split("\n").map(l => l.trimEnd());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // === HSXEngine / :Hsx: / CCCL handled here ===
      i = this.runHSXEngineLine(line, lines, i);

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
        const type = line.slice(1, 3);
        i++;
        while (i < lines.length && !lines[i].match(/^}\s*$/)) { block += lines[i] + "\n"; i++; }
        if (type === "js") await this._runJS(block, true);
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

      // === New HSX / Meta / Fun / Emotions ===
      if (line.startsWith("hsx:") || line.startsWith("(hsx)")) { await this._handleNewHSXCommands(line); continue; }
      if (line.startsWith("(funny)")) { await this._handleFunnyBlock(line, lines, i); continue; }

      console.log(`ℹ️ HSX meta line: ${line}`);
    }
    console.log("✅ HSX execution complete!");
  }

  // === Helpers (full runtime functionality) ===
  _extractQuotes(str) { const m = str.match(/"(.*?)"/); return m ? m[1] : ""; }

  _attachMedia(type, src) { const el = document.createElement(type); el.src = src; if (type === "video" || type === "audio") el.controls = true; if (type === "img") el.style.width = "400px"; document.body.appendChild(el); console.log(`📎 Attached ${type}: ${src}`); }

  _renderComponent(name) { if (!this.components[name]) return console.warn(`⚠️ Component not found: ${name}`); const el = document.createElement("div"); el.innerHTML = this.components[name]; document.body.appendChild(el); console.log(`✨ Rendered component: ${name}`); }

  async _runJS(code, domSafe = false) { try { if (domSafe) { new Function(`document.addEventListener('DOMContentLoaded',()=>{try{${code}}catch(e){console.error('❌ JS error:',e);}}`)(); } else { new Function(code)(); } console.log("💻 JS executed"); } catch(e){ console.error("❌ JS error:", e); } }

  async _runPy(code) { if (this.pyodide) try { await this.pyodide.runPythonAsync(code); console.log("🐍 Python executed"); } catch(e){ console.error("❌ Python error:", e);} }

  async _runHSXBlock(code) {
    if (!this.sandboxed) { console.warn("⚠️ HSX block skipped (sandbox off)"); return; }
    const lines = code.split("\n").map(l => l.trim());
    for (let line of lines) {
      if (!line) continue;

      if (line.endsWith(".ps") || line.endsWith(".ks")) { await this._runModule(line.trim()); continue; }
      if (line.includes("eq") || line.includes("-") || line.includes(",")) { this._parseAttachmentLegacy(line); continue; }
      if (line.startsWith("hsx:fun")) { await this._runFun(line.replace("hsx:fun","").trim()); continue; }
      if (line.startsWith("{js")) await this._runJS(line.replace("{js","").replace("}","").trim());
      else if (line.startsWith("{py")) await this._runPy(line.replace("{py","").replace("}","").trim());
      if (this.emotionActive) this._checkEmotions(line);
    }
  }

  _parseAttachmentLegacy(line) {
    const key = line.split("eq")[0].replace("hsx:new","").trim();
    let val = [];
    if (line.includes(",")) val = line.split("eq")[1].split(",").map(v=>v.trim());
    else val = line.split(/eq|-/).slice(1).map(v=>v.trim());
    this.attachments[key] = val;
    console.log("📎 Attachment stored:", key, this.attachments[key]);
  }

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

  async _runFun(code) {
    console.log("🌀 Fun mode running...");
    const lines = code.split(/[\n;]/).map(l=>l.trim()).filter(Boolean);
    for (let line of lines) {
      if (!line) continue;
      if (line.endsWith(".ps") || line.endsWith(".ks")) await this._runModule(line);
      else if (line.startsWith("{js")) await this._runJS(line.replace("{js","").replace("}","").trim());
      else if (line.startsWith("{py")) await this._runPy(line.replace("{py","").replace("}","").trim());
      else try { new Function(line)(); console.log("🌀 Fun fallback executed:", line); } catch(e){ console.error("❌ Fun fallback error:", e);}
    }
  }

  async _handleNewHSXCommands(line) {
    if (line.startsWith("(hsx) hsx extract modules")) { console.log("📦 HSX module extraction enabled"); return; }
    if (line.startsWith("(hsx) module extraction")) { console.log("📦 Module extraction flag set"); return; }
    if (line.startsWith("(hsx) create new file")) { console.log(`📄 New file creation: ${line}`); return; }
    if (line.startsWith("(hsx) create new block")) {
      const name = line.replace("(hsx) create new block cal it","").replace(":)","").trim();
      this.blocks[name] = { data: {}, code: "" };
      console.log(`🆕 Block created: ${name}`);
      return;
    }
    if (line.startsWith("(hsx) allow data and export")) { this.dataExportActive = true; console.log("📤 Data export enabled"); return; }
    if (line.startsWith("(hsx) allow emotions")) { this.emotionActive = true; console.log("😃 Emotions enabled"); return; }
    if (line.startsWith("(hsx) allow meta data set")) { this.metaActive = true; console.log("📝 Meta data enabled"); return; }
    if (line.startsWith("(hsx) make new meta data tag")) {
      const tag = line.split(":")[1]?.trim();
      if (tag) { this.metaTags[tag] = {}; console.log(`🏷️ Meta tag registered: ${tag}`); }
      return;
    }
    console.log("ℹ️ HSX new command:", line);
  }

  async _handleFunnyBlock(line, lines, i) {
    const name = line.replace("(funny)","").split(":")[0].trim();
    const contentLines = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith("(funny)")) { contentLines.push(lines[j]); j++; }
    this.blocks[name] = { data: {}, code: contentLines.join("\n") };
    console.log(`😂 Funny block created: ${name}`);
  }

  _checkEmotions(line) {
    const symbols = [":)", "(:", "):", ":(", ";)", ";(", ");", "(;", "{:}", ").(:"];
    for (let sym of symbols) {
      if (line.includes(sym)) {
        if (!this.emotions[sym]) console.log(`😊 Emotion triggered: ${sym} in line -> "${line}"`);
        else try { this.emotions[sym](line); } catch(e){ console.error("❌ Emotion handler error:", e);}
      }
    }
  }

  async loadFromFile(file) { await this.execute(await file.text()); }
  async loadFromText(text) { await this.execute(text); }
}

// Auto-init & drag-drop & auto-load
window.HSXRuntime = HSXRuntime;

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

if (location.search.includes("hsxFiles=")) {
  const filesParam = new URLSearchParams(location.search).get("hsxFiles");
  const files = filesParam.split(",");
  const hsx = new HSXRuntime();
  hsx.loadFiles(files);
} else if (location.pathname.endsWith(".hsx")) {
  const hsx = new HSXRuntime();
  hsx.load(location.pathname);
}
