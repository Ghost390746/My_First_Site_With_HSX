// HSX Language Extension Engine
// Universal JavaScript (runs anywhere)

class HSXEngine {
    constructor() {
        // Databases
        this.botsDB = {};                  // bots data
        this.customDatabaseBlocks = {};    // user-created custom blocks

        // Storage
        this.storages = {};                // normal storage types
        this.physicStorage = {};           // hidden permanent storage
        this.customStorages = {};          // user-defined storage formats

        // Custom Code
        this.customCodeLines = {};         // CCCL-created custom code lines
    }

    // ---------- SECRET PHYSIC STORAGE ----------
    embedPhysic(storageName) {
        // Store secretly inside the engine
        this.physicStorage[storageName] = this.storages[storageName];
        Object.defineProperty(this, `_physic_${storageName}`, {
            value: this.storages[storageName],
            writable: true,
            enumerable: false
        });
    }

    // ---------- USER-DEFINED STORAGE ----------
    createCustomStorage(name) {
        this.customStorages[name] ??= {};
        return this.customStorages[name];
    }

    // ---------- ENGINE ----------
    run(code) {
        const lines = code.split("\n");
        let i = 0;

        while (i < lines.length) {
            let line = lines[i].trim();

            // -------- BOTS DATABASE BLOCK --------
            if (line === "bots:") {
                this.botsDB.records ??= [];
                i++;

                while (lines[i]?.trim().startsWith(";:")) {
                    const raw = lines[i].replace(";:", "").trim();
                    const [name, bot, meta] = raw.split(",").map(v => v.trim());

                    this.botsDB.records.push({
                        name,
                        bot,
                        meta,
                        formats: {}
                    });

                    i++;
                }
                continue;
            }

            // -------- HSX STORAGE CREATION --------
            if (line === ":Hsx:") {
                i++;
                let next = lines[i]?.trim();

                // PHYSIC STORAGE
                if (next?.startsWith("$")) {
                    const storageName = next.replace("$", "").trim();
                    this.storages[storageName] ??= {};
                    i++;

                    while (lines[i]?.includes("=")) {
                        let [k, v] = lines[i].split("=").map(x => x.trim());
                        this.storages[storageName][k] = v.replace(/"/g, "");
                        i++;
                    }

                    // Embed secretly inside the engine
                    this.embedPhysic(storageName);
                }

                // CUSTOM STORAGE
                else if (next?.startsWith("create storage")) {
                    const storageName = next.split(" ").slice(2).join(" ").trim();
                    this.createCustomStorage(storageName);
                    i++;

                    while (lines[i]?.includes("=")) {
                        let [k, v] = lines[i].split("=").map(x => x.trim());
                        this.customStorages[storageName][k] = v.replace(/"/g, "");
                        i++;
                    }
                }

                // CUSTOM DATABASE BLOCKS
                else if (next?.endsWith(":") && !next.startsWith("$")) {
                    const dbName = next.replace(":", "");
                    this.customDatabaseBlocks[dbName] ??= [];
                    i++;

                    while (lines[i]?.trim().startsWith(";:")) {
                        this.customDatabaseBlocks[dbName].push(lines[i].replace(";:", "").trim());
                        i++;
                    }
                }

                continue;
            }

            // -------- CCCL CUSTOM CODE LINES --------
            if (line.startsWith("CCCL")) {
                const name = line.split(" ")[1];
                i++;
                let block = [];

                while (lines[i]?.trim() !== "}") {
                    block.push(lines[i]);
                    i++;
                }

                // Combine all code lines into one block
                this.customCodeLines[name] = block.join("\n");
                i++;
                continue;
            }

            // -------- EXECUTE CUSTOM CODE --------
            if (this.customCodeLines[line]) {
                this.run(this.customCodeLines[line]);
                i++;
                continue;
            }

            i++;
        }
    }
}
