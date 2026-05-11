// -------------------------------------------------------------------
// RPi² API SOCKET CLIENT
// -------------------------------------------------------------------
import {spawn} from "child_process"
import {io} from "socket.io-client"
import {log, warn, traceCfg} from "./esm/log.mjs"
import {ctrlC, sleep} from "./esm/ctl.mjs"
import {suid} from "./esm/uid.mjs"

class Rpisquare {

    static SOCKET_SERVER = "https://socket.rpisquare.com"
    static SOCKET_OPTIONS = {
        secure: true,
        forceNew: true,
        transports: ["websocket"],
        pingInterval: 10000,
        pingTimeout: 10000
    }
    static API_SERVER = "https://api.rpisquare.com"
    static REX = {
        EMAIL: new RegExp("^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"),
        TOKEN: new RegExp("^[0-9a-fA-F]{32}$"),
    }

    /** --------------------------------------------------------------
     * @method constructor
     * @description Check user email and token then authenticate on socket server
     * @param {String} email
     * @param {String} token
     * @param {Object} opt
     * @return {Object}
     */
    constructor(email = "", token = "", opt) {

        const defopt = {
            // Define console mode => 2: log+warning, 1: warning, 0: none
            debug: 1,
            // Socket connection tolerance time in ms
            connectTime: 1000,
            // By default, operations are logged in rpisquare console => To define per operation
            console: true,
            // By default, operations have no callback function => To define per operation
            callback: false,
            // Set threshold in ms to filter consecutive monitored events of same type
            rebounce: 30
        }
        opt = {...defopt, ...opt}

        // Set log level
        traceCfg(opt.debug)

        // Stop on invalid user email
        if (!Rpisquare.REX.EMAIL.test(email)) throw new Error("Invalid email address")

        // Stop on invalid token
        if (!Rpisquare.REX.TOKEN.test(token)) throw new Error("Invalid token")


        // Run ctrl+c
        ctrlC(() => {
            this.interrupted = true
            log("ctrl+c")
        })
        this.interrupted = false
        this.email = email
        this.token = token
        this.connectTime = opt.connectTime
        this.isConnected = false // Set on connection success
        this.agents = [] // Agent list set by method connect()
        this.agentsAreLoaded = false // Set on agent load success
        this.ops = {} // Init operation log
        this.console = opt.console
        this.callback = opt.callback
        this.rebounce = opt.rebounce
    }

    // ----------------------------------------------------------------
    // PRIVATE METHODS
    /** ---------------------------------------------------------------
     * @method #api
     * @description JSON post to API server
     * @param {String} path
     * @param {Object} params
     * @return {Object} JSON object
     */
    async #api(path, params = {}) {
        const url = Rpisquare.API_SERVER + path
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

    /** --------------------------------------------------------------
     * @method #emitOperation
     * @description Test command parameters and emit operation object
     * @param {String} serial   - Target agent serial
     * @param {Number} line     - GPIO line number
     * @param {String} cmd      - write, read...
     * @param {Object} params   - Command dependent. See below
     * @param {Object} opt      - By default, inherit from constructor.See below
     *                            Used also to pass monitor callback function for monitoringStart
     * @return {Number}         - 400, 410, 420 or 200
     */
    #emitOperation(serial, line, cmd, params = {}, opt) {

        const defopt = {
            console: this.console,
            callback: this.callback
        }
        opt = {...defopt, ...opt}

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

    // ----------------------------------------------------------------
    // PUBLIC METHODS
    /** --------------------------------------------------------------
     * @method connect
     * @description Connect to socket server
     * @return {Promise} this.isConnected && this.agentsAreLoaded
     */
    async connect() {

        // Init web socket and related events
        try {

            // Init websocket with user email in query
            this.socket = io(Rpisquare.SOCKET_SERVER, {
                ...Rpisquare.SOCKET_OPTIONS, ...{
                    query: {
                        email: this.email,
                        token: this.token
                    }
                }
            })

            this.socket.on("connect", () => {
                this.isConnected = true
                log("socket is connected:", this.socket.id)
            })

            this.socket.on("connect_error", async err => {
                warn("Socket connect error:", err.message)
                await sleep(5000)
                this.restart()
            })

            // Acknowledge for emitted command
            this.socket.on("acknowledge", ack => {

                const id = ack.id
                delete ack.id
                if (id) {
                    this.ops[id].res = ack
                    this.ops[id].respondedAt = new Date()

                    // Translate error code 2xx to 6xx for agent errors
                    if (ack.code !== 200 && ack.code < 300) this.ops[id].res.code = 400 + ack.code

                    // Exec callback
                    if (typeof this.ops[id].callback === "function") {
                        this.ops[id].callback(this.ops[id].res)
                    }
                }
            })

            // Monitoring events
            this.socket.on("monitor", args => {
                log("monitor:", args)
            })
        } catch (err) {
            throw new Error("Network error - Please retry later: " + err)
        }

        // Wait for socket connection before continuing
        let i = Math.round(this.connectTime / 10)
        while (!this.isConnected && i > 0) {
            await sleep(10, false)
            i--
        }
        if (i <= 0) warn("socket connection issue => retry later")

        // Load agent list
        this.agents = []
        this.agentsAreLoaded = false
        const res = await this.#api("/client/gpios", {
            email: this.email,
            token: this.token
        })
        if (res.code !== 200) {
            warn("agents load error:", res.code, res.msg)
            return
        }
        this.agents = res.data
        this.agentsAreLoaded = true
        return this.isConnected && this.agentsAreLoaded
    }

    /** ---------------------------------------------------------------
     * @method restart
     * @description Restart current script if not interrupted by ctrl+c
     */
    restart() {

        if (!this.interrupted) {
            // Spawn new Node.js process with script arg
            spawn(process.execPath, process.argv.slice(1), {
                detached: true,  // child independent of parent
                stdio: 'inherit' // inherit stdin/stdout/stderr
            }).unref() // parent exit when child start
            process.exit() // kill all process
        }
    }

    /** --------------------------------------------------------------
     * @method write
     * @description Set value of a remote output GPIO
     * @param {String} serial
     * @param {Number} line
     * @param {Number} value
     * @param {Object} opt - Overwrite constructor values for console and feedback
     * @return {Number}
     */
    write(serial, line, value, opt = {}) {
        return this.#emitOperation(serial, line, "write", {toWrite: value}, opt)
    }

    /** --------------------------------------------------------------
     * @method read
     * @description Set value of a remote input GPIO
     * @param {String} serial
     * @param {Number} line
     * @param {Object} opt - Overwrite constructor values for console and feedback
     * @return {Number}
     */
    read(serial, line, opt = {}) {
        return this.#emitOperation(serial, line, "read", {}, opt)
    }

    /** --------------------------------------------------------------
     * @method monitoringStart
     * @description Start monitoring of a remote input GPIO
     * @param {String} serial
     * @param {Number} line
     * @param {Function} monitor - Callback function to receive monitoring events
     * @param {String} edge - both, rising, falling
     * @param {Object} opt - Overwrite constructor values for console, feedback and rebounce
     * @return {Number}
     */
    monitoringStart(serial, line, monitor, edge = "both", opt = {}) {

        // Retrieve rebounce if not set
        typeof opt.rebounce === "undefined" ? opt.rebounce = this.rebounce : false

        // 430: Invalid edge
        if (["rising", "falling", "both"].indexOf(edge) === -1) return 430

        // 431: Callback function is mandatory for monitoring
        if (typeof monitor !== "function") return 431

        // 432: Invalid rebounce:  0 <= t <= 10000
        if (typeof opt.rebounce !== "number" || opt.rebounce < 0 || opt.rebounce > 10000) return 432

        return this.#emitOperation(serial, line, "monitoringStart", {rebounce: opt.rebounce}, {monitor: monitor})
    }


    /** --------------------------------------------------------------
     * @method monitoringStop
     * @description Stop monitoring of a remote input GPIO
     * @param {String} serial
     * @param {Number} line
     * @param {Object} opt - Overwrite constructor values for console and feedback
     * @return {Number}
     */
    monitoringStop(serial, line, opt = {}) {
        return this.#emitOperation(serial, line, "monitoringStop", opt)
    }

    /** --------------------------------------------------------------
     * @method restartAgent
     * @description Restart remote agent
     * @param {String} serial
     * @param {Object} opt
     * @return {Number}
     */
    restartAgent(serial, opt = {}) {
        return this.#emitOperation(serial, 0, "restartAgent", {}, opt)
    }

    /** --------------------------------------------------------------
     * @method pwmDuty
     * @description Update PWM GPIO duty cycle with a percentage between duty min and max
     * @param {String} serial
     * @param {Number} line
     * @param {Number} percent (0-100)
     * @param {Object} opt
     * @return {Number}
     */
    pwmDuty(serial, line, percent, opt = {}) {
        return this.#emitOperation(serial, line, "pwmDuty", {dutyPercent: percent}, opt)
    }
}

// -------------------------------------------------------------------
const myClient = new Rpisquare("guillaume@dorbes.com", "004b0033007100380067006500410051", {
    debug: 2,
    console: true,
    callback: res => {
        log("callback res =>", res.code, res.msg, res.data)
    }
})
log("client is defined")
log("client is connected:", await myClient.connect())

myClient.write("55a63df5bf3a8f54", 17, 1)
await sleep(1000)
myClient.write("55a63df5bf3a8f54", 17, 0)
await sleep(1000)
myClient.read("55a63df5bf3a8f54", 18)
log("monitoring start:", myClient.monitoringStart("55a63df5bf3a8f54", 18, res => {
    log("monitored data:", res)
}, "both", {rebounce: 100}))
await sleep(5000)
myClient.pwmDuty("55a63df5bf3a8f54", 13, 0)
await sleep(3000)
myClient.pwmDuty("55a63df5bf3a8f54", 13, 50)
await sleep(3000)
myClient.pwmDuty("55a63df5bf3a8f54", 13, 100)
await sleep(3000)
myClient.pwmDuty("55a63df5bf3a8f54", 13, 200)

// log("monitoring stop:", myClient.monitoringStop("55a63df5bf3a8f54", 18))
// await sleep(5000)
// log("ready to restart:", myClient.restartAgent("55a63df5bf3a8f54"))
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------