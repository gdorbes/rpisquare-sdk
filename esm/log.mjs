// -------------------------------------------------------------------
// RPi² SDK - Timestamped console.log
/** ------------------------------------------------------------------
 * @function nowStr
 * @description Return timestamp as formatted string
 * @return {String}
 */
const nowStr = () => {
    const date = new Date()
    return date.toLocaleTimeString() + "." + date.getMilliseconds().toLocaleString('en', {
        minimumIntegerDigits: 3,
        minimumFractionDigits: 0,
        useGrouping: false
    })
}

/** ------------------------------------------------------------------
 * @function log
 * @description Global customized timestamped console.log
 *              Requires global variable 'debug'
 */
export const log = function () {
    console.log.apply(console, Array.prototype.concat.apply([nowStr(), "🔎 "], arguments))
}

/** ------------------------------------------------------------------
 * @function warn
 * @description Colored log for error messages ⚠️ Node.js only ~ CSS color #F50
 */
export const warn = function () {
    console.log.apply(console, Array.prototype.concat.apply([nowStr(), "⚠️", "\x1b[38;2;255;80;0m", ...arguments, "\x1b[0m"]))
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------