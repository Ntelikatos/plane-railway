// Compares the published Railway template with .railway/railway.ts.
//
//   node scripts/template.mjs           lists what the template must contain
//   node scripts/template.mjs --check   fails on any difference from the template
//                                       linked by the README's deploy button
//
// Railway builds a template from a live project but drops plain values and
// variable descriptions, and has no API to edit a template's contents. Those
// are filled in once in the template editor; this script keeps them equal to
// the code. See docs/template-maintenance.md.
import { readFileSync } from "node:fs";
import { createRailwayContext } from "railway/iac";
import program from "../.railway/railway.ts";

const norm = (s) => String(s ?? "").replace(/\$\{\{\s*/g, "${{").replace(/\s*\}\}/g, "}}");

const definition = await program(createRailwayContext({ environment: "production" }), (name, d) => ({ name, ...d }));
const expected = definition.resources.flat().filter((r) => r.type === "service").map((s) => ({
  name: s.name,
  source: s.source.image ?? `https://github.com/${s.source.repo}`,
  rootDirectory: s.source.rootDirectory ?? null,
  startCommand: s.deploy?.startCommand ?? null,
  preDeployCommand: s.deploy?.preDeployCommand ?? null,
  healthcheckPath: s.deploy?.healthcheckPath ?? null,
  mounts: Object.values(s.volumeAttachments ?? {}).map((a) => a.mountPath).sort(),
  domainPort: Object.values(s.networking?.serviceDomains ?? {})[0]?.port ?? null,
  variables: Object.fromEntries(
    Object.entries(s.variables ?? {}).map(([k, x]) => [k, { value: norm(x.value?.value ?? x.value), description: x.value?.description ?? "" }]),
  ),
}));

if (!process.argv.includes("--check")) {
  for (const s of expected) {
    console.log(`\n## ${s.name}`);
    for (const [k, x] of Object.entries(s.variables)) console.log(`${k}\t${x.value}\t${x.description}`);
  }
  process.exit(0);
}

const code = readFileSync(new URL("../README.md", import.meta.url), "utf8").match(/railway\.com\/deploy\/([\w-]+)/)?.[1];
if (!code) throw new Error("README has no deploy button");
// The template is generated from a project that builds the proxy from main,
// so the first merge happens before the template exists.
if (code === "TEMPLATE_CODE") {
  console.log("::notice::README has no template code yet; nothing to compare.");
  process.exit(0);
}

const res = await fetch("https://backboard.railway.com/graphql/v2", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: `{ template(code: "${code}") { serializedConfig } }` }),
});
const body = await res.json();
if (!body.data?.template) throw new Error(`template ${code}: ${JSON.stringify(body.errors)}`);
const actual = Object.values(body.data.template.serializedConfig.services);

const problems = [];
const same = (where, want, got) => {
  if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`${where}: want ${JSON.stringify(want)}, template has ${JSON.stringify(got)}`);
};
for (const want of expected) {
  const got = actual.find((s) => s.name === want.name);
  if (!got) { problems.push(`${want.name}: missing from the template`); continue; }
  same(`${want.name} source`, want.source, got.source?.image ?? got.source?.repo);
  same(`${want.name} rootDirectory`, want.rootDirectory, got.source?.rootDirectory ?? null);
  same(`${want.name} startCommand`, want.startCommand, got.deploy?.startCommand ?? null);
  same(`${want.name} preDeployCommand`, want.preDeployCommand, got.deploy?.preDeployCommand ?? null);
  same(`${want.name} healthcheckPath`, want.healthcheckPath, got.deploy?.healthcheckPath ?? null);
  same(`${want.name} mounts`, want.mounts, Object.values(got.volumeMounts ?? {}).map((m) => m.mountPath).sort());
  same(`${want.name} domain port`, want.domainPort, Object.values(got.networking?.serviceDomains ?? {})[0]?.port ?? null);
  same(`${want.name} variables`, Object.keys(want.variables).sort(), Object.keys(got.variables ?? {}).sort());
  for (const [k, x] of Object.entries(want.variables)) {
    const g = got.variables?.[k];
    if (!g) continue;
    same(`${want.name}.${k} value`, x.value, norm(g.defaultValue));
    same(`${want.name}.${k} description`, x.description, g.description ?? "");
  }
}
for (const got of actual) if (!expected.some((s) => s.name === got.name)) problems.push(`${got.name}: in the template but not in railway.ts`);

if (problems.length) {
  console.error(`Template ${code} differs from .railway/railway.ts:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Template ${code} matches .railway/railway.ts (${expected.length} services).`);
