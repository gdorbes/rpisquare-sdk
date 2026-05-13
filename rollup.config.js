import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    // On pointe vers ton fichier principal défini dans package.json
    input: './esm/sdk.mjs',
    output: [
        {
            file: './dist/rpisquare-sdk.browser.js',
            format: 'iife', // Format auto-exécutable pour le navigateur
            name: 'RPiSquare', // Nom de la variable globale (ex: RPiSquare.init())
            sourcemap: true
        }
    ],
    plugins: [
        // Indique à Rollup de chercher socket.io-client dans node_modules
        resolve({
            browser: true // Utilise la version browser des dépendances si elle existe
        }),
        // Convertit les éventuels restes de CommonJS en ESM
        commonjs()
    ]
};
