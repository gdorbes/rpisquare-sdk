// -------------------------------------------------------------------
// RPi² API SOCKET SDK FOR BOTH BROWSER AND NODEJS
// -------------------------------------------------------------------
import {io} from "socket.io-client"
import {log, warn, traceCfg} from "./log.mjs"
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
        12: "Authentication error"
    }
}
let ram = {
    socket: {},      // socket data
    ops: {},         // operation log
}
let fun = {} // Private functions
export let sdk = {} // Public functions

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
// -------------------------------------------------------------------
// PUBLIC FUNCTIONS
/** ------------------------------------------------------------------
 * @method sdk.authenticate
 * @description Check user email and token then authenticate on socket server
 * @param {String} email
 * @param {String} token
 * @return {Object}
 */
sdk.authenticate = async (email = "", token = "") => {
    // Set trave level: warning and log
    traceCfg(2)
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
        return fun.response(200, "")
    } catch (error) {
        return fun.response(12, error.message)
    }
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------