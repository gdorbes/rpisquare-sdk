// -------------------------------------------------------------------
// RPISQUARE SDK - TEST FOR NODEJS
// -------------------------------------------------------------------
import {sdk} from "../esm/sdk.mjs"

const started = await sdk.authenticate("guillaume@dorbes.com", "00790033007500350041007300530062")
sdk.log("agent list:", started.data)


