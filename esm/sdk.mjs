// -------------------------------------------------------------------
// RPi² SDK FOR BOTH BROWSER AND NODEJS
// -------------------------------------------------------------------
import {io} from "socket.io-client"
import {log, warn} from "./log.mjs"
import {ctrlC, sleep} from "./ctl.mjs"
import {suid} from "./uid.mjs"

// -------------------------------------------------------------------
// CONSTANTS AND VARIABLES
// -------------------------------------------------------------------
const ROM = {
    SOCKET_SERVER: "https://socket.rpisquare.com",
    SOCKET_OPTIONS: {
        secure: true,
        forceNew: true,
        transports: ["websocket"],
        pingInterval: 10000,
        pingTimeout: 10000
    },
    API_SERVER: "https://api.rpisquare.com",
    REGEX: {
        EMAIL: new RegExp("^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"),
        TOKEN: new RegExp("^[0-9a-fA-F]{32}$"),
    },
    ERROR: {
        200: "ok",
        10: "Invalid email address",
        11: "Invalid token",
        12: "Socket authentication error",
        13: "Agent loading error"
    }
}
let ram = {
    socket: {},      // socket data
    ops: {},         // operation log
    agents: [],      // agent list
    opt: {
        // By default, operations are logged in rpisquare console
        // Could be overwritten per operation
        console: true,
        // By default, operations have no callback function
        // Could be overwritten per operation
        callback: false,
        // Set threshold in ms to filter consecutive monitored events of same type
        rebounce: 30
    }
}
let fun = {} // Private functions

// -------------------------------------------------------------------
// PRIVATE FUNCTIONS
/** ------------------------------------------------------------------
 * @function fun.response
 * @description Return code-based response object
 * @param {Number} code
 * @param {Object} data
 * @return {Object} JSON object
 */
fun.response = (code, data) => {
    return {
        code: code,
        msg: ROM.ERROR[code],
        data: data
    }
}

/** ------------------------------------------------------------------
 * @function fun.api
 * @description JSON post to API server
 * @param {String} path
 * @param {Object} params
 * @return {Object} JSON object
 */
fun.api = async (path, params = {}) => {
    const url = ROM.API_SERVER + path
    log("post req:", url, params)
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Access-Control-Origin": "*"
            },
            mode: "cors",
            body: JSON.stringify(params)
        })
        const json = await response.json()
        log("post res:", url, json)
        return json
    } catch (err) {
        const netErr = {
            code: 100,
            msg: "network error",
            data: err
        }
        log("post res:", url, netErr)
        return netErr
    }
}

/** ------------------------------------------------------------------
 * @function fun.connectSocket
 * @description To manage socket connect in async mode
 */
fun.connectSocket = (socket) => {
    return new Promise((resolve, reject) => {

        // Already connected, resolve immediately
        if (socket.connected) {
            resolve(socket)
            return
        }

        // One-time listeners
        socket.once("connect", () => {
            // Clean up the error listener
            socket.off("connect_error")
            resolve(socket)
        })
        socket.once("connect_error", (err) => {
            socket.off("connect")
            reject(err)
        });
    });
}

/** --------------------------------------------------------------
 * @function fun.emitOperation
 * @description Check command parameters and emit operation object
 * @param {String} serial   - Target agent serial
 * @param {Number} line     - GPIO line number
 * @param {String} cmd      - write, read...
 * @param {Object} params   - Command dependent. See below
 * @param {Object} opt      - By default, inherit from constructor.See below
 *                            Used also to pass monitor callback function for monitoringStart
 * @return {Number}         - 400, 410, 420 or 200
 */
/*
fun.emitOperation = (serial, line, cmd, params = {}, opt) => {

    opt = {
        console: ram.opt.console,
        callback: ram.opt.callback,
        ...opt
    }

    let mode
    switch (cmd) {
        case "write":
            mode = "out"
            break
        case "read":
            mode = "in"
            break
        case "monitoringStart":
            mode = "in"
            break
        case "monitoringStop":
            mode = "in"
            break
        case "pwmDuty":
            mode = "pwm"
            break
        default: // Used for global agent commands e.g. closeAll, restartAgent
            mode = "none"
    }

    const agent = this.agents.find(agent => {
        return agent.serial === serial
    })

    // 400: Unknown serial number
    if (!agent) {
        warn("gpio operation rejected. Error 0: Unknown serial number")
        return 400
    }

    // Line tests when mode is set
    if (mode !== "none") {

        // 410: Unknown line in serial agent when mode is defined
        const lineId = Object.keys(agent.gpio).find(id => {
            return agent.gpio[id].line === line
        })
        if (!lineId) {
            warn("gpio operation rejected. Error 1: Unknown line for defined agent")
            return 410
        }

        // 420: Line mode is invalid
        if (mode !== agent.gpio[lineId].mode) {
            warn("gpio operation rejected. Error 2: Line mode is not valid:", mode)
            return 420
        }
    }
    // 200: Define operation. Add it to ops list. Emit it
    let ope = {
        id: suid(),
        command: cmd,
        serial: serial,
        line: line,
        params: params,
        // Optional acknowledge if callback is defined as a function
        fbAck: (typeof opt.callback === "function"),
        // Optional display in rpisquare app console
        fbCon: opt.console
    }

    this.ops[ope.id] = {
        req: ope,
        reqTime: new Date(),
        res: false,
        resTime: false,
        callback: opt.callback
    }
    // Add monitor if required
    cmd === "monitoringStart" && typeof opt.monitor === "function" ? this.ops[ope.id].monitor = opt.monitor : false

    this.socket.emit("operation", ope)
    log("ope+", ope)
    return 200
}
*/
// -------------------------------------------------------------------
// PUBLIC FUNCTIONS
// -------------------------------------------------------------------
export let sdk = {}
/** ------------------------------------------------------------------
 * @function sdk.log
 * @description Timestamped console.log
 * @argument
 */
sdk.log = log
/** ------------------------------------------------------------------
 * @function sdk.authenticate
 * @description Check user email and token then authenticate on socket server
 * @param {String} email
 * @param {String} token
 * @return {Object}
 */
sdk.authenticate = async (email = "", token = "") => {

    log("starting sdk")

    // ERR 10: Invalid email address
    if (email.length === 0 || !ROM.REGEX.EMAIL.test(email)) return fun.response(10, email)

    // ERR 11: Invalid token
    if (token.length === 0 || !ROM.REGEX.TOKEN.test(token)) return fun.response(11, token)

    // Init websocket with user email authentication
    ram.socket = io(ROM.SOCKET_SERVER, {
        ...ROM.SOCKET_OPTIONS, ...{
            query: {
                email: email,
                token: token
            }
        }
    })
    try {
        log("attempting to connect...")
        await fun.connectSocket(ram.socket)
        log("socket connected")

        log("loading agents...")
        const res = await fun.api("/client/gpios", {
            email: email,
            token: token
        })
        if (res.code !== 200) return fun.response(12, res.msg)
        ram.agents = res.data
        log("agents loaded")

        return fun.response(200, res.data)
    } catch (error) {
        return fun.response(12, error.message)
    }
}

/** --------------------------------------------------------------
 * @function sdk.write
 * @description Set value of a remote output GPIO
 * @param {String} serial
 * @param {Number} line
 * @param {Number} value
 * @param {Object} opt - to overwrite default console and feedback
 * @return {Number}
 */
sdk.write = (serial, line, value, opt = {}) => {
    return fun.emitOperation(serial, line, "write", {toWrite: value}, opt)
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------