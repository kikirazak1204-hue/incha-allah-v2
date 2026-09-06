#!/usr/bin/env node
/**
 * analyze-project.js
 * -------------------
 * Scanne un projet frontend et produit un rapport complet :
 *  - arborescence exacte (chemins + noms de fichiers)
 *  - composants exportés par fichier
 *  - imports utilisés
 *  - classes Tailwind de couleur/fond détectées
 *  - présence ou non de variantes "dark:" (utile pour savoir ce qui est déjà prêt)
 *  - taille et nombre de lignes de chaque fichier
 *
 * Usage :
 *   node analyze-project.js [chemin_du_projet] [--out rapport.md]
 *
 * Exemple :
 *   node analyze-project.js ./mon-app --out analyse-dashboard.md
 *
 * Aucune dépendance externe : Node.js natif uniquement.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".turbo",
  ".cache",
  "coverage",
]);

const RELEVANT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".html",
  ".vue",
]);

const args = process.argv.slice(2);
const rootArg = args.find((a) => !a.startsWith("--")) || ".";
const outFlagIndex = args.indexOf("--out");
const outFile = outFlagIndex !== -1 ? args[outFlagIndex + 1] : "project-analysis.md";

const ROOT = path.resolve(rootArg);

// ---------------------------------------------------------------------------
// Utilitaires d'extraction de contenu
// ---------------------------------------------------------------------------

function extractExportedComponents(content) {
  const matches = new Set();
  const patterns = [
    /export\s+default\s+function\s+([A-Za-z0-9_]+)/g,
    /export\s+default\s+([A-Za-z0-9_]+)\s*;/g,
    /export\s+function\s+([A-Za-z0-9_]+)/g,
    /export\s+const\s+([A-Za-z0-9_]+)\s*=/g,
    /class\s+([A-Za-z0-9_]+)\s+extends\s+React\.Component/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      matches.add(m[1]);
    }
  }
  return [...matches];
}

function extractImports(content) {
  const imports = [];
  const re = /import\s+(?:[\w*{}\s,]+)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

function extractColorClasses(content) {
  // Détecte les classes Tailwind liées aux couleurs / fonds / bordures
  const re = /\b(bg|text|border|from|via|to|ring|fill|stroke)-(?:\[[^\]]+\]|[a-z]+-?\d{0,3}(?:\/\d{1,3})?)\b/g;
  const set = new Set(content.match(re) || []);
  return [...set];
}

function hasDarkVariant(content) {
  return /\bdark:/.test(content);
}

function hasHardcodedHex(content) {
  const matches = content.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  return [...new Set(matches)];
}

function countLines(content) {
  return content.split("\n").length;
}

// ---------------------------------------------------------------------------
// Parcours du système de fichiers
// ---------------------------------------------------------------------------

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(fullPath, results);
    } else {
      const ext = path.extname(entry.name);
      if (RELEVANT_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);

  return {
    path: path.relative(ROOT, filePath),
    absolutePath: filePath,
    name: path.basename(filePath),
    ext: path.extname(filePath),
    sizeKb: (stat.size / 1024).toFixed(1),
    lines: countLines(content),
    components: extractExportedComponents(content),
    imports: extractImports(content),
    colorClasses: extractColorClasses(content),
    hasDarkVariant: hasDarkVariant(content),
    hardcodedHex: hasHardcodedHex(content),
  };
}

function buildReport(files) {
  const lines = [];
  lines.push(`# Analyse du projet\n`);
  lines.push(`Racine analysée : \`${ROOT}\`  `);
  lines.push(`Fichiers trouvés : **${files.length}**\n`);

  lines.push(`## Sommaire des fichiers\n`);
  lines.push(`| Fichier | Chemin | Lignes | Taille | Dark déjà présent | Couleurs en dur (hex) |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const f of files) {
    lines.push(
      `| ${f.name} | \`${f.path}\` | ${f.lines} | ${f.sizeKb} Ko | ${f.hasDarkVariant ? "✅" : "—"} | ${
        f.hardcodedHex.length ? f.hardcodedHex.join(", ") : "—"
      } |`
    );
  }

  lines.push(`\n## Détail par fichier\n`);
  for (const f of files) {
    lines.push(`### \`${f.path}\`\n`);
    lines.push(`- **Composants exportés** : ${f.components.length ? f.components.join(", ") : "aucun détecté"}`);
    lines.push(`- **Imports** : ${f.imports.length ? f.imports.join(", ") : "aucun"}`);
    lines.push(
      `- **Classes de couleur Tailwind détectées** (${f.colorClasses.length}) : ${
        f.colorClasses.length ? f.colorClasses.slice(0, 40).join(", ") : "aucune"
      }${f.colorClasses.length > 40 ? " …" : ""}`
    );
    lines.push(`- **Variante \`dark:\` déjà utilisée** : ${f.hasDarkVariant ? "oui" : "non"}`);
    lines.push(
      `- **Couleurs codées en dur (hex)** : ${f.hardcodedHex.length ? f.hardcodedHex.join(", ") : "aucune"}`
    );
    lines.push("");
  }

  lines.push(`## Fichiers candidats pour le mode clair/sombre\n`);
  const candidates = files.filter(
    (f) => f.colorClasses.length > 0 && !f.hasDarkVariant
  );
  if (candidates.length === 0) {
    lines.push("Tous les fichiers avec des couleurs ont déjà une variante `dark:`.");
  } else {
    for (const f of candidates) {
      lines.push(`- \`${f.path}\` — ${f.colorClasses.length} classes de couleur, pas de \`dark:\` pour l'instant`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

if (!fs.existsSync(ROOT)) {
  console.error(`Le chemin "${ROOT}" n'existe pas.`);
  process.exit(1);
}

const filePaths = walk(ROOT);
const analyzed = filePaths.map(analyzeFile);
const report = buildReport(analyzed);

fs.writeFileSync(outFile, report, "utf8");

console.log(`Analyse terminée : ${analyzed.length} fichiers.`);
console.log(`Rapport écrit dans : ${path.resolve(outFile)}`);
console.log("");
console.log("Résumé rapide :");
for (const f of analyzed) {
  console.log(
    `- ${f.path}  (${f.lines} lignes, ${f.colorClasses.length} classes de couleur, dark:${f.hasDarkVariant ? "oui" : "non"})`
  );
}