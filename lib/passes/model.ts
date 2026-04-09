/**
 * Inline pass model assets for Vercel compatibility.
 * On Vercel, public/ is served by CDN and not available to serverless functions.
 * These base64-encoded assets are bundled with the function code.
 */

const PASS_JSON = {
  formatVersion: 1,
  passTypeIdentifier: "APPLE_PASS_TYPE_IDENTIFIER",
  teamIdentifier: "APPLE_TEAM_IDENTIFIER",
  organizationName: "UMD Indian Student Association",
  description: "Des Rangila Digital Passport",
  serialNumber: "PLACEHOLDER",
  foregroundColor: "rgb(255, 255, 255)",
  backgroundColor: "rgb(99, 102, 241)",
  labelColor: "rgb(199, 210, 254)",
  logoText: "Des Rangila",
  eventTicket: {
    headerFields: [],
    primaryFields: [],
    secondaryFields: [],
    auxiliaryFields: [],
    backFields: [],
  },
  barcodes: [],
};

// PNG assets base64-encoded (29x29 icon, 58x58 icon@2x, 160x50 logo, 320x100 logo@2x)
const ICON_PNG = "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAIAAADZ8fBYAAAAJklEQVR4nGNITvtIC8Qwau6ouaPmjpo7au6ouaPmjpo7au6gMhcAYV2sVvMExAkAAAAASUVORK5CYII=";
const ICON_2X_PNG = "iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAIAAABu2d1/AAAATElEQVR4nO3OQQkAMAwEsHotzP8czMJ+10IgAlJ97iIVH+iOoaurq6urq6urm6arq6urq6urq5umq6urq6urq6ubpqurq6urq6v74wFiXbFz+cLtUgAAAABJRU5ErkJggg==";
const LOGO_PNG = "iVBORw0KGgoAAAANSUhEUgAAAKAAAAAyCAIAAABUA0cyAAAAkElEQVR4nO3RAQkAIBDAwO8q2N8GphBhHFyAwWbtQ9h8L+Apg+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuA4g+MMjjM4zuC4C2DV95xGM/oxAAAAAElFTkSuQmCC";
const LOGO_2X_PNG = "iVBORw0KGgoAAAANSUhEUgAAAUAAAABkCAIAAAB4uH5pAAABQElEQVR4nO3TwQkAIBDAsNtVcH83cAc/UghkgH46ax8gar4XAM8MDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhjADQ5iBIczAEGZgCDMwhBkYwgwMYQaGMANDmIEhzMAQZmAIMzCEGRjCDAxhBoYwA0OYgSHMwBBmYAgzMIQZGMIMDGEGhrALN2zemqi5c9YAAAAASUVORK5CYII=";

/**
 * Returns the pass model as a Buffer map (no filesystem access needed).
 * Compatible with PKPass.from({ model: getPassModel(), ... })
 */
export function getPassModel(): Record<string, Buffer> {
  return {
    "pass.json": Buffer.from(JSON.stringify(PASS_JSON)),
    "icon.png": Buffer.from(ICON_PNG, "base64"),
    "icon@2x.png": Buffer.from(ICON_2X_PNG, "base64"),
    "logo.png": Buffer.from(LOGO_PNG, "base64"),
    "logo@2x.png": Buffer.from(LOGO_2X_PNG, "base64"),
  };
}
