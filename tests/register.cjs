// Run the project's TypeScript with its existing compiler, without a test dependency or emitted files.
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...rest) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, ...rest)
}
require.extensions[".ts"] = function (loaded, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  loaded._compile(output.outputText, filename)
}
