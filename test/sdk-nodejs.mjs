// -------------------------------------------------------------------
// RPISQUARE SDK - TEST FOR NODEJS
// -------------------------------------------------------------------
import {log, authenticate} from "../esm/sdk.mjs"

const started = await authenticate("guillaume@dorbes.com", "00790033007500350041007300530062")
log("agent list:", started.data)


