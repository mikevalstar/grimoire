/**
 * Assets imported with `with { type: "file" }`: Bun's bundler emits the file
 * next to the bundle and the import is the path to it
 * ([ADR 0017](../../../docs/adrs/0017-decode-webp-covers-with-a-wasm-codec.md)).
 *
 * Referenced from the modules that use it rather than only listed here — the
 * server and desktop workspaces typecheck these sources without including this
 * directory, so an ambient file nobody points at is invisible to them.
 */
declare module "*.wasm" {
  const path: string;
  export default path;
}
