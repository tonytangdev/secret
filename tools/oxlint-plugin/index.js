// Local oxlint JS plugin: bans that oxlint has no native rule for.
// Plain ESLint-v9-style plugin object (no imports needed).
const RUN = /^run(Promise|Sync|Fork|Callback)/

const simple = (message, visitors) => ({
  meta: { type: "problem", docs: { description: message }, schema: [] },
  create(context) {
    const report = (node) => context.report({ node, message })
    return Object.fromEntries(visitors.map((v) => [v, report]))
  },
})

const plugin = {
  meta: { name: "secret" },
  rules: {
    "require-disable-reason": {
      meta: {
        type: "problem",
        docs: { description: "disable comments need -- reason" },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            for (const c of context.sourceCode.getAllComments()) {
              const m = /^\s*((?:oxlint|eslint)-disable(?:-next-line|-line)?)\b(.*)$/s.exec(c.value)
              if (m && !/\s--\s+\S/.test(m[2]))
                context.report({ loc: c.loc, message: m[1] + ' needs a "-- reason"' })
            }
          },
        }
      },
    },
    "no-async": simple("async functions are banned here; use Effect.gen / Effect.fn", [
      "FunctionDeclaration[async=true]",
      "FunctionExpression[async=true]",
      "ArrowFunctionExpression[async=true]",
    ]),
    "no-await": simple("await is banned here; use yield* inside Effect.gen", ["AwaitExpression"]),
    "no-try-catch": simple("try/catch is banned here; use Effect.try / Effect.catch*", [
      "TryStatement",
    ]),
    "no-throw": simple("throw is banned here; use Effect.fail / Effect.die", ["ThrowStatement"]),
    "no-new-promise": simple("new Promise is banned here; use Effect.async / Effect.callback", [
      "NewExpression[callee.name='Promise']",
    ]),
    "no-effect-run": {
      meta: {
        type: "problem",
        docs: { description: "Effect.run* only in entry files" },
        schema: [],
      },
      create(context) {
        const message = "Effect.run* / runtime.run* is only allowed in entry files"
        return {
          MemberExpression(node) {
            if (node.property.type === "Identifier" && RUN.test(node.property.name)) {
              context.report({ node, message })
            }
          },
          ImportSpecifier(node) {
            const name =
              node.imported.type === "Identifier" ? node.imported.name : node.imported.value
            if (RUN.test(name)) context.report({ node, message })
          },
        }
      },
    },
  },
}

export default plugin
