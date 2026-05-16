/**
 * Bulk vendor import — reads a JSON file of `{ templates: [...] }`, dedupes against
 * the live DB, validates, generates a SQL file, and applies it via wrangler.
 *
 * Usage:
 *   npx tsx seed/import-vendor.ts --file=<path> [--remote] [--dry-run] [--update]
 *
 * --update: existing (manufacturer, modelNumber) rows are UPDATEd in place
 *           (preserving id and created_at) instead of skipped.
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { DEVICE_TYPE_TO_CATEGORY } from "../../src/deviceTypeCategories";
import { validateTemplate, type TemplateInput } from "../src/validate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "..");
const migrationsDir = path.join(apiDir, "migrations");

// --- CLI args ----------------------------------------------------------------
const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="))?.slice("--file=".length);
const isRemote = args.includes("--remote");
const dryRun = args.includes("--dry-run");
const isUpdate = args.includes("--update");

if (!fileArg) {
  console.error("Usage: npx tsx seed/import-vendor.ts --file=<path> [--remote] [--dry-run] [--update]");
  process.exit(1);
}

const inputPath = path.resolve(fileArg);
console.log(`Reading ${inputPath}`);
const raw = JSON.parse(readFileSync(inputPath, "utf-8")) as {
  templates: Record<string, unknown>[];
};

if (!Array.isArray(raw.templates)) {
  console.error("Input must be { templates: [...] }");
  process.exit(1);
}

// --- Dynamically read current schema version from highest migration ----------
const migrationFiles = readdirSync(migrationsDir).filter((f) => /^\d{4}_.*\.sql$/.test(f));
const currentSchemaVersion = migrationFiles
  .map((f) => parseInt(f.slice(0, 4), 10))
  .reduce((a, b) => (a > b ? a : b), 0)
  .toString();
console.log(`Current schema version: ${currentSchemaVersion}`);

// --- Stats counters ----------------------------------------------------------
let droppedCustom = 0;
let droppedMissingRequired = 0;
let droppedInternalDup = 0;
let droppedExistingInDb = 0;
let droppedInvalid = 0;
let updatedExisting = 0;

// --- Step 1: pre-filter (missing mfr/model, "custom" modelNumber) ------------
const prefiltered: Record<string, unknown>[] = [];
for (const t of raw.templates) {
  const mfr = typeof t.manufacturer === "string" ? t.manufacturer.trim() : "";
  const model = typeof t.modelNumber === "string" ? t.modelNumber.trim() : "";
  if (!mfr || !model) {
    droppedMissingRequired++;
    continue;
  }
  if (model.toLowerCase() === "custom") {
    droppedCustom++;
    continue;
  }
  prefiltered.push(t);
}

// --- Step 2: internal dedup on lower(mfr::model) -----------------------------
const seen = new Set<string>();
const deduped: Record<string, unknown>[] = [];
for (const t of prefiltered) {
  const key = `${(t.manufacturer as string).trim().toLowerCase()}::${(t.modelNumber as string).trim().toLowerCase()}`;
  if (seen.has(key)) {
    droppedInternalDup++;
    continue;
  }
  seen.add(key);
  deduped.push(t);
}

// --- Step 3: normalize -------------------------------------------------------
function normalize(t: Record<string, unknown>): Record<string, unknown> {
  const deviceType = t.deviceType as string;
  const category = DEVICE_TYPE_TO_CATEGORY[deviceType];
  if (!category) {
    throw new Error(`Unmapped deviceType "${deviceType}" on template "${t.label}"`);
  }

  const ports = (t.ports as Record<string, unknown>[]).map((p, i) => {
    const out: Record<string, unknown> = { ...p };
    // Strip "Inputs"/"Outputs" section labels — they're redundant with direction
    // and break the convention of using sections only for semantic groupings.
    if (typeof out.section === "string" && /^(inputs?|outputs?)$/i.test(out.section.trim())) {
      delete out.section;
    }
    out.id = (typeof p.id === "string" && p.id.trim()) ? p.id : `port-${i}`;
    return out;
  });

  const rawTerms = Array.isArray(t.searchTerms) ? (t.searchTerms as string[]) : [];
  const uniqueTerms = [...new Set(rawTerms.filter((s) => typeof s === "string"))].slice(0, 20);

  return {
    ...t,
    category,
    ports,
    ...(uniqueTerms.length > 0 && { searchTerms: uniqueTerms }),
  };
}

const normalized = deduped.map(normalize);

// --- Step 4: validate --------------------------------------------------------
const validated: { id: string; input: TemplateInput }[] = [];
for (const t of normalized) {
  const result = validateTemplate(t);
  if (!result.ok) {
    console.warn(`  [invalid] ${t.label ?? "(no label)"}: ${result.error}`);
    droppedInvalid++;
    continue;
  }
  validated.push({ id: randomUUID(), input: result.data });
}

// --- Step 5: query existing DB, filter out already-present (mfr, model) ------
console.log(`\n${validated.length} validated templates. Checking DB for existing models...`);

const manufacturers = [...new Set(validated.map((v) => v.input.manufacturer!.trim().toLowerCase()))];
const existingIds = new Map<string, string>(); // key -> existing template id (UUID)
const flag = isRemote ? "--remote" : "--local";

for (const mfr of manufacturers) {
  // single-quote SQL literal; escape embedded quotes.
  const mfrEsc = mfr.replace(/'/g, "''");
  const cmd = `npx wrangler d1 execute easyschematic-db ${flag} --json --command="SELECT id, lower(manufacturer)||'::'||lower(model_number) AS k FROM templates WHERE lower(manufacturer)='${mfrEsc}'"`;
  const out = execSync(cmd, { cwd: apiDir, encoding: "utf-8" });
  const parsed = JSON.parse(out);
  const rows: { id: string; k: string }[] = parsed[0]?.results ?? [];
  for (const r of rows) existingIds.set(r.k, r.id);
  console.log(`  ${mfr}: ${rows.length} existing in DB`);
}

// Split validated rows into fresh inserts vs updates.
const fresh: { id: string; input: TemplateInput }[] = [];
const updates: { id: string; input: TemplateInput }[] = [];
for (const v of validated) {
  const key = `${v.input.manufacturer!.trim().toLowerCase()}::${v.input.modelNumber!.trim().toLowerCase()}`;
  const existingId = existingIds.get(key);
  if (existingId != null) {
    if (isUpdate) {
      updates.push({ id: existingId, input: v.input });
      updatedExisting++;
    } else {
      droppedExistingInDb++;
    }
  } else {
    fresh.push(v);
  }
}

console.log(`\n${fresh.length} new templates to import${isUpdate ? `, ${updates.length} to update` : ""}.`);

if (fresh.length === 0 && updates.length === 0) {
  console.log("Nothing to import. Done.");
  process.exit(0);
}

// --- Step 6: generate SQL ----------------------------------------------------
function escapeSQL(s: string): string {
  return s.replace(/'/g, "''");
}

function sqlStr(s: string | null | undefined): string {
  return s != null ? `'${escapeSQL(s)}'` : "NULL";
}

function sqlNum(n: number | null | undefined): string {
  return n != null ? String(n) : "NULL";
}

const lines: string[] = [];
fresh.forEach(({ id, input }, i) => {
  const searchTerms = input.searchTerms ? sqlStr(JSON.stringify(input.searchTerms)) : "NULL";
  const ports = sqlStr(JSON.stringify(input.ports));
  const slots = input.slots ? sqlStr(JSON.stringify(input.slots)) : "NULL";
  const auxData = input.auxiliaryData ? sqlStr(JSON.stringify(input.auxiliaryData)) : "NULL";

  lines.push(
    `INSERT INTO templates (` +
      `id, version, device_type, category, label, short_name, manufacturer, model_number, color, image_url, reference_url, ` +
      `search_terms, ports, slots, slot_family, power_draw_w, power_capacity_w, voltage, thermal_btuh, poe_budget_w, poe_draw_w, unit_cost, ` +
      `is_venue_provided, height_mm, width_mm, depth_mm, weight_kg, auxiliary_data, sort_order, ` +
      `approved_at, approved_schema_version, needs_review` +
    `) VALUES (` +
      `'${id}', 1, ${sqlStr(input.deviceType)}, ${sqlStr(input.category)}, ${sqlStr(input.label)}, ${sqlStr(input.shortName)}, ` +
      `${sqlStr(input.manufacturer)}, ${sqlStr(input.modelNumber)}, ${sqlStr(input.color)}, ${sqlStr(input.imageUrl)}, ${sqlStr(input.referenceUrl)}, ` +
      `${searchTerms}, ${ports}, ${slots}, ${sqlStr(input.slotFamily)}, ${sqlNum(input.powerDrawW)}, ${sqlNum(input.powerCapacityW)}, ${sqlStr(input.voltage)}, ${sqlNum(input.thermalBtuh)}, ${sqlNum(input.poeBudgetW)}, ${sqlNum(input.poeDrawW)}, ${sqlNum(input.unitCost)}, ` +
      `${input.isVenueProvided ? "1" : "NULL"}, ${sqlNum(input.heightMm)}, ${sqlNum(input.widthMm)}, ${sqlNum(input.depthMm)}, ${sqlNum(input.weightKg)}, ${auxData}, ${i}, ` +
      `datetime('now'), '${currentSchemaVersion}', 0` +
    `);`
  );
});

updates.forEach(({ id, input }) => {
  const searchTerms = input.searchTerms ? sqlStr(JSON.stringify(input.searchTerms)) : "NULL";
  const ports = sqlStr(JSON.stringify(input.ports));
  const slots = input.slots ? sqlStr(JSON.stringify(input.slots)) : "NULL";
  const auxData = input.auxiliaryData ? sqlStr(JSON.stringify(input.auxiliaryData)) : "NULL";

  // UPDATE in place: preserve id and created_at; refresh approved_at/approved_schema_version.
  lines.push(
    `UPDATE templates SET ` +
      `device_type=${sqlStr(input.deviceType)}, category=${sqlStr(input.category)}, label=${sqlStr(input.label)}, short_name=${sqlStr(input.shortName)}, ` +
      `manufacturer=${sqlStr(input.manufacturer)}, model_number=${sqlStr(input.modelNumber)}, color=${sqlStr(input.color)}, ` +
      `image_url=${sqlStr(input.imageUrl)}, reference_url=${sqlStr(input.referenceUrl)}, ` +
      `search_terms=${searchTerms}, ports=${ports}, slots=${slots}, slot_family=${sqlStr(input.slotFamily)}, ` +
      `power_draw_w=${sqlNum(input.powerDrawW)}, power_capacity_w=${sqlNum(input.powerCapacityW)}, voltage=${sqlStr(input.voltage)}, ` +
      `thermal_btuh=${sqlNum(input.thermalBtuh)}, poe_budget_w=${sqlNum(input.poeBudgetW)}, poe_draw_w=${sqlNum(input.poeDrawW)}, unit_cost=${sqlNum(input.unitCost)}, ` +
      `is_venue_provided=${input.isVenueProvided ? "1" : "NULL"}, ` +
      `height_mm=${sqlNum(input.heightMm)}, width_mm=${sqlNum(input.widthMm)}, depth_mm=${sqlNum(input.depthMm)}, weight_kg=${sqlNum(input.weightKg)}, ` +
      `auxiliary_data=${auxData}, ` +
      `approved_at=datetime('now'), approved_schema_version='${currentSchemaVersion}', needs_review=0 ` +
    `WHERE id='${id}';`
  );
});

const vendor = (validated[0]?.input.manufacturer ?? "vendor").toLowerCase().replace(/\s+/g, "-");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const sqlPath = path.join(__dirname, `import-${vendor}-${timestamp}.sql`);
writeFileSync(sqlPath, lines.join("\n"), "utf-8");
console.log(`\nGenerated SQL: ${sqlPath}`);

// --- Step 7: summary ---------------------------------------------------------
console.log("\n--- Summary ---");
console.log(`Input templates:              ${raw.templates.length}`);
console.log(`  dropped (missing mfr/model): ${droppedMissingRequired}`);
console.log(`  dropped ("custom" model):    ${droppedCustom}`);
console.log(`  dropped (internal dup):      ${droppedInternalDup}`);
console.log(`  dropped (invalid):           ${droppedInvalid}`);
console.log(`  dropped (already in DB):     ${droppedExistingInDb}`);
console.log(`  to import (new):             ${fresh.length}`);
if (isUpdate) console.log(`  to update (existing):        ${updatedExisting}`);

// --- Step 8: apply (unless dry-run) -----------------------------------------
if (dryRun) {
  console.log("\n--dry-run: skipping apply. Inspect the SQL above.");
  process.exit(0);
}

console.log(`\nApplying to D1 (${flag})...`);
execSync(`npx wrangler d1 execute easyschematic-db ${flag} --file=${path.relative(apiDir, sqlPath)}`, {
  cwd: apiDir,
  stdio: "inherit",
});
console.log("\nDone.");
