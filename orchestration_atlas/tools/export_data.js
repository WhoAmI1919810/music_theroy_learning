#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const evidence = path.join(root, "evidence");
fs.mkdirSync(evidence, { recursive: true });

const instruments = require(path.join(root, "app", "data", "instruments.js"));
const theory = require(path.join(root, "app", "data", "theory-data.js"));
const mechanisms = require(path.join(root, "app", "data", "mechanisms.js"));
const sources = require(path.join(root, "app", "data", "sources.js"));

const payloads = {
  "instruments.json": instruments,
  "theory.json": theory,
  "mechanisms.json": mechanisms,
  "source-map.json": sources
};

for (const [fileName, payload] of Object.entries(payloads)) {
  fs.writeFileSync(path.join(evidence, fileName), JSON.stringify(payload, null, 2), "utf8");
  process.stdout.write("wrote evidence/" + fileName + "\n");
}
