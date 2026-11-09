#!/usr/bin/env node
// Fails if any oxlint-disable* / eslint-disable* comment lacks a `-- reason`.
// Usage: node tools/check-disable-reasons.mjs [files...]  (default: all tracked .ts/.tsx/.js/.mjs)
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const exts = /\.(?:[cm]?[jt]sx?)$/
const args = process.argv.slice(2)
const files = (
  args.length > 0
    ? args
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
        encoding: "utf8",
      }).split("\n")
).filter((f) => exts.test(f))

// Matches the directive inside // or /* */ comments.
const directive =
  /(?:\/\/|\/\*)\s*((?:oxlint|eslint)-disable(?:-next-line|-line)?)\b([^\n]*?)(?:\*\/|$)/gm
const hasReason = /\s--\s+\S/

const problems = []
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n")
  lines.forEach((line, i) => {
    for (const m of line.matchAll(directive)) {
      if (!hasReason.test(m[2] ?? ""))
        problems.push(`${file}:${i + 1}: \`${m[1]}\` needs a "-- reason"`)
    }
  })
}
if (problems.length > 0) {
  console.error(problems.join("\n"))
  console.error(`\n${problems.length} disable comment(s) without a reason.`)
  process.exit(1)
}
