// ───────────────────────────────────────────────────────────────────────────
// Jeder `*:check`-Lauf aus package.json steht auch im CI-Workflow.
//
// WARUM ES DAS GIBT (angelegt 2026-09-19). Der Zwilling dieses Laufs hat im
// `multicam-planner` am selben Tag einen Pruef-Lauf gefunden, den package.json
// fuehrte und der CI-Workflow nicht ausfuehrte: `slider:check`, sieben Tage
// gruen und nie gefahren. Hier stimmt die Liste HEUTE — und genau deshalb
// steht der Guard jetzt hier und nicht erst, wenn sie nicht mehr stimmt.
//
// „Ein Guard, den niemand faehrt, ist keine Zusicherung, sondern eine Notiz."
// Eine Zusicherung, die gebaut, begruendet und unerreichbar ist, ist schlimmer
// als keine — sie steht im README und im Kopf dessen, der sich auf sie
// verlaesst.
//
// WARUM ALS BERECHNETE LISTE UND NICHT ALS AUFZAEHLUNG. Eine Liste, die
// jemand hinschreibt, ist der Kenntnisstand ihres Autors am Tag des
// Hinschreibens. Der zehnte Pruef-Lauf, den jemand in vier Wochen anlegt,
// faellt hier auf, ohne dass er diese Datei kennen muss. Das ist der ganze
// Zweck: die Liste soll niemand pflegen muessen.
//
// Lauf: `npm run ci:complete`
// ───────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// Der Workflow-Pfad ist relativ zum Skript. In einer vendorten Kopie (die
// av-planner-suite legt `scripts/` unter `apps/cable-planner/` ab,
// `.github/` bleibt beim Wirt) gibt es ihn nicht. Ohne diese Abfrage waere die
// Meldung ein ENOENT-Stacktrace auf einen Pfad, den niemand sucht — mit ihr
// steht da, was tatsaechlich fehlt. Der Lauf scheitert in beiden Faellen, und
// das ist Absicht: „Workflow nicht gefunden" heisst „nicht geprueft", und ein
// nicht geprueftes Versprechen darf nicht gruen aussehen.
const workflowPfad = new URL('../.github/workflows/ci.yml', import.meta.url);

if (!existsSync(workflowPfad)) {
  console.error(`FEHLER: ${workflowPfad.pathname} existiert nicht.`);
  console.error('Dieser Guard vergleicht package.json gegen den CI-Workflow desselben');
  console.error('Repos. Liegt das Skript in einer vendorten Kopie ohne eigenes');
  console.error('.github/, hat er nichts zu vergleichen — dann gehoert er dort auch');
  console.error('nicht in die Pruef-Kette, statt still durchzulaufen.');
  process.exit(1);
}

// Ohne reine Kommentarzeilen. Gemessen 2026-09-05 im `cable-planner`: ein
// Kommentar, der `npm run actions:check` bloss ERWAEHNT, hat den dortigen
// Zwilling dieses Guards zufriedengestellt — der Lauf stand nirgends als
// Schritt und waere bei keinem Merge gefahren. Die Zusicherung, die dieser
// Guard geben soll, war damit von einem Satz Prosa zu haben.
//
// Nur ganze Kommentarzeilen fallen weg; ein `#` mitten in einer Zeile bleibt
// stehen (es steckt in URLs und Shell-Zeilen, und ein zu eifriges Wegschneiden
// waere die naechste stille Fehlerquelle).
const workflow = readFileSync(workflowPfad, 'utf8')
  .split('\n')
  .filter((zeile) => !/^\s*#/.test(zeile))
  .join('\n');

const checks = Object.keys(pkg.scripts ?? {})
  .filter((name) => name.endsWith(':check'))
  .sort();

if (checks.length === 0) {
  console.error('FEHLER: kein einziger *:check-Lauf in package.json gefunden.');
  console.error('Entweder wurden alle entfernt, oder dieser Guard misst nichts mehr.');
  process.exit(1);
}

// Ein Lauf gilt als gefahren, wenn er als eigener Schritt im Workflow steht
// ODER an `test`/`lint` haengt — beide fuehrt der Workflow aus. Die zweite
// Form ist die, die `inventory-planner` und `larszu-facility-planner` nutzen
// (`test` = `vitest run && grenze:check && lang:check`); sie hier nicht zu
// kennen hiesse, einen gefahrenen Lauf als fehlend zu melden.
const angehaengt = `${pkg.scripts?.test ?? ''} ${pkg.scripts?.lint ?? ''}`;
const fehlend = checks.filter(
  (name) => !workflow.includes(`npm run ${name}`) && !angehaengt.includes(name),
);

if (fehlend.length > 0) {
  console.error(`FEHLER: ${fehlend.length} von ${checks.length} Pruef-Laeufen werden nie gefahren:\n`);
  for (const name of fehlend) console.error(`  ! ${name}  (in package.json, nicht im Workflow und nicht an test/lint)`);
  console.error('\nEin Guard, den niemand faehrt, ist keine Zusicherung, sondern eine Notiz.');
  console.error('Eintragen als eigener Schritt in .github/workflows/ci.yml:');
  for (const name of fehlend) {
    console.error(`      - name: <was er zusichert>\n        run: npm run ${name}`);
  }
  process.exit(1);
}

console.log(`OK: alle ${checks.length} Pruef-Laeufe werden gefahren (${checks.join(', ')}).`);
