// -------------------------------------------------------------------
// RPi² ROLLUP CONFIG FOR WEB DEPLOYMENT
// INSTALL: npm install --save-dev rollup @rollup/plugin-node-resolve @rollup/plugin-terser
// VERIFY: npx rollup --version
// BUILDER: (1) npx rollup -c
//          (2) npm run build when package.json includes   "scripts": {"build": "rollup -c"}
// -------------------------------------------------------------------
import resolve  from "@rollup/plugin-node-resolve"
import terser   from "@rollup/plugin-terser"

export default {
    input: "esm/sdk.mjs",
    output: {
        file:   "dist/rpisquare-sdk.js",
        format: "umd",
        name:   "rpisquare",
        globals: {
            'socket.io-client': "io",
        },
        sourcemap: true,
    },
    external: ["socket.io-client"],
    plugins: [
        resolve({ browser: true }),
        terser()
    ]
}
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------
