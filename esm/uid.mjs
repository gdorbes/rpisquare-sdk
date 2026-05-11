// ---------------------------------------------------------------------
// Short UID
// ---------------------------------------------------------------------

/** --------------------------------------------------------------------
 * @function suid
 * @description Return a 8-character short ID (a-z,A-7,0-0)
 * @return {String}
 */
export const suid = () => {

    // Convert number to a base62 string according to a base e.g. 62
    Number.prototype.toBase = function (base) {
        const symbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
        let decimal = this
        let conversion = ""

        if (base > symbols.length || base <= 1) {
            return false
        }

        while (decimal >= 1) {
            conversion = symbols[(decimal - (base * Math.floor(decimal / base)))] + conversion
            decimal = Math.floor(decimal / base)
        }

        return (base < 11) ? parseInt(conversion) : conversion
    };

    // 50 years offset in ms
    const offset = 1577847600000

    // Random alpha
    const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    const start = Math.floor(Math.random() * alpha.length)
    const letter = alpha.substring(start, start + 1)

    // Return random alphanum + base62 timestamp
    return letter + (new Date().getTime() - offset).toBase(62)
}

// ---------------------------------------------------------------------
// EoF
// ---------------------------------------------------------------------

