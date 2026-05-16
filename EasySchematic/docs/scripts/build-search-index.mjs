#!/usr/bin/env node
// Generates docs/src/searchIndex.json by parsing the JSX in each page component.
// Runs at dev startup and as a prebuild step.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";
import traverseMod from "@babel/traverse";

const traverse = traverseMod.default ?? traverseMod;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_SRC = path.resolve(__dirname, "..", "src");

// ---- 1. Pull the routes map out of DocsApp.tsx --------------------------------

const appSrc = fs.readFileSync(path.join(DOCS_SRC, "DocsApp.tsx"), "utf8");
const appAst = parse(appSrc, { sourceType: "module", plugins: ["jsx", "typescript"] });

const importedComponents = {}; // ComponentName -> relative path (e.g. "./pages/Overview")
const routes = {}; // slug -> { title, componentName }

traverse(appAst, {
  ImportDeclaration(p) {
    const src = p.node.source.value;
    if (!src.startsWith("./pages/")) return;
    for (const spec of p.node.specifiers) {
      if (spec.type === "ImportDefaultSpecifier") importedComponents[spec.local.name] = src;
    }
  },
  VariableDeclarator(p) {
    if (p.node.id.type !== "Identifier" || p.node.id.name !== "routes") return;
    if (p.node.init?.type !== "ObjectExpression") return;
    for (const prop of p.node.init.properties) {
      if (prop.type !== "ObjectProperty" || prop.value.type !== "ObjectExpression") continue;
      const slug =
        prop.key.type === "StringLiteral" ? prop.key.value :
        prop.key.type === "Identifier" ? prop.key.name : null;
      if (slug == null) continue;
      let title = "", componentName = "";
      for (const sub of prop.value.properties) {
        if (sub.type !== "ObjectProperty" || sub.key.type !== "Identifier") continue;
        if (sub.key.name === "title" && sub.value.type === "StringLiteral") title = sub.value.value;
        if (sub.key.name === "component" && sub.value.type === "Identifier") componentName = sub.value.name;
      }
      if (title && componentName) routes[slug] = { title, componentName };
    }
  },
});

// ---- 2. Text extraction helpers ----------------------------------------------

function textOfJSXChildren(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case "JSXText": {
      const t = node.value.replace(/\s+/g, " ").trim();
      if (t) out.push(t);
      return out;
    }
    case "StringLiteral": {
      const t = node.value.trim();
      if (t) out.push(t);
      return out;
    }
    case "TemplateLiteral": {
      for (const q of node.quasis) {
        const t = (q.value.cooked ?? q.value.raw ?? "").trim();
        if (t) out.push(t);
      }
      for (const e of node.expressions) textOfJSXChildren(e, out);
      return out;
    }
    case "JSXExpressionContainer":
      return textOfJSXChildren(node.expression, out);
    case "JSXFragment":
      for (const c of node.children) textOfJSXChildren(c, out);
      return out;
    case "JSXElement":
      for (const c of node.children) textOfJSXChildren(c, out);
      return out;
    case "ConditionalExpression":
      textOfJSXChildren(node.consequent, out);
      textOfJSXChildren(node.alternate, out);
      return out;
    case "LogicalExpression":
    case "BinaryExpression":
      textOfJSXChildren(node.left, out);
      textOfJSXChildren(node.right, out);
      return out;
    case "ArrayExpression":
      for (const e of node.elements) textOfJSXChildren(e, out);
      return out;
  }
  return out;
}

const elementName = (el) => el?.openingElement?.name?.name ?? null;

const HEADING_RE = /^h[1-6]$/;
const CONTENT_RE = /^(p|ul|ol|li|pre|blockquote|table|details|summary|figcaption)$/;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ---- 3. Walk each page and bucket content by heading --------------------------

const entries = [];
let nextId = 1;

// Prefer named slugs over the "" root alias when the same component appears under both.
const componentToPreferredSlug = {};
for (const [slug, { componentName }] of Object.entries(routes)) {
  if (!(componentName in componentToPreferredSlug) || slug !== "") {
    componentToPreferredSlug[componentName] = slug;
  }
}
const seenComponents = new Set();
for (const [slug, { title, componentName }] of Object.entries(routes)) {
  if (seenComponents.has(componentName)) continue;
  if (componentToPreferredSlug[componentName] !== slug) continue;
  seenComponents.add(componentName);
  const rel = importedComponents[componentName];
  if (!rel) continue;
  const file = path.join(DOCS_SRC, rel + ".tsx");
  if (!fs.existsSync(file)) continue;

  const ast = parse(fs.readFileSync(file, "utf8"), {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  // Each page gets an implicit "intro" section under the page title + h1.
  const sections = [{ heading: title, level: 1, text: [] }];

  traverse(ast, {
    JSXElement: {
      enter(p) {
        const name = elementName(p.node);
        if (!name) return;
        if (HEADING_RE.test(name)) {
          const text = textOfJSXChildren(p.node).join(" ").replace(/\s+/g, " ").trim();
          const level = Number(name[1]);
          // Skip h1s that just repeat the page title (common pattern).
          if (level === 1 && text.toLowerCase() === title.toLowerCase()) { p.skip(); return; }
          sections.push({ heading: text || "Untitled", level, text: [] });
          p.skip();
        } else if (CONTENT_RE.test(name)) {
          const text = textOfJSXChildren(p.node).join(" ").replace(/\s+/g, " ").trim();
          if (text) sections[sections.length - 1].text.push(text);
          p.skip();
        }
        // else: descend (div, section, main, Fragment-wrapped wrappers, etc.)
      },
    },
  });

  for (const s of sections) {
    const content = s.text.join(" ").replace(/\s+/g, " ").trim();
    if (!content && s.level !== 1) continue; // drop empty headings except the page intro
    entries.push({
      id: nextId++,
      path: slug,
      pageTitle: title,
      heading: s.heading,
      headingSlug: slugify(s.heading),
      level: s.level,
      content,
    });
  }
}

// ---- 4. Write it out ----------------------------------------------------------

const outPath = path.join(DOCS_SRC, "searchIndex.json");
fs.writeFileSync(outPath, JSON.stringify(entries));
const pageCount = new Set(entries.map((e) => e.path)).size;
console.log(`OK  Search index: ${entries.length} sections across ${pageCount} pages → ${path.relative(path.resolve(__dirname, ".."), outPath)}`);
