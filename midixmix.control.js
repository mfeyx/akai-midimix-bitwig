loadAPI(18);

host.defineController(
  "Akai",
  "Akai Midimix",
  "0.1",
  "7b8cd61c-2718-4d77-80b5-a2103f92b69c",
  "mfeyx",
);
host.addDeviceNameBasedDiscoveryPair(["MIDI Mix"], ["MIDI Mix"]);
host.defineMidiPorts(1, 1);

/* ------------------------------------------------------ */
/*                    DEBUGGING FEATURE                   */
/* ------------------------------------------------------ */
var DEBUG = true;

function debug(bool = false) {
  DEBUG = bool;
  return;
}

/* ------------------------------------------------------ */
/*                         LOGGING                        */
/* ------------------------------------------------------ */
function log(msg) {
  if (DEBUG) {
    println(msg);
  }
}

/* ------------------------------------------------------ */
/*                       MIDI SPECS                       */
/* ------------------------------------------------------ */
const ON = 127;
const OFF = 0;

const NOTE_ON = 144; // 0x90
const NOTE_OFF = 128; // 0x80
const CC = 0xb0;

/* ------------------------------------------------------ */
/*                          NAMES                         */
/* ------------------------------------------------------ */
const KNOB = "encoder";
const MAIN = "mainVolume";
const CHAN = "chanVolume";

// do not change those values,
// they are called like the api methods, e.g. channel.solo()
const SOLO = "solo";
const MUTE = "mute";
const RECO = "arm";

/* ------------------------------------------------------ */
/*                         CONSTS                         */
/* ------------------------------------------------------ */
const MIN_PAGE = 0;
const MAX_PAGE = 20;
const NUM_FADERS = 8;
const TRACKS = MAX_PAGE * NUM_FADERS;

/* ------------------------------------------------------ */
/*                         RUNNERS                        */
/* ------------------------------------------------------ */
var SHIFT_PRESSED = false;
let CHANNEL_PAGE = 0;

/* ------------------------------------------------------ */
/*                        HARDWARE                        */
/* ------------------------------------------------------ */

/* ----------------- BUTTONS RIGHT PANEL ---------------- */
const BANKL = 25; // 0x19
const BANKR = 26; // 0x1a
const SHIFT = 27; // 0x1b

/* ----------------------- ENCODER ---------------------- */
const CC_SENDS = {
  25: {chan: 0, send: 0},
  26: {chan: 0, send: 1},
  28: {chan: 1, send: 0},
  29: {chan: 1, send: 1},
  31: {chan: 2, send: 0},
  32: {chan: 2, send: 1},
  34: {chan: 3, send: 0},
  35: {chan: 3, send: 1},
  46: {chan: 4, send: 0},
  47: {chan: 4, send: 1},
  50: {chan: 5, send: 0},
  51: {chan: 5, send: 1},
  54: {chan: 6, send: 0},
  55: {chan: 6, send: 1},
  58: {chan: 7, send: 0},
  59: {chan: 7, send: 1},
};
const CC_SEND_ENCODERS = Object.keys(CC_SENDS).map(Number);

// third row
const CC_ENCODERS = {
  27: {chan: 0, send: 2},
  30: {chan: 1, send: 2},
  33: {chan: 2, send: 2},
  36: {chan: 3, send: 2},
  48: {chan: 4, send: 2},
  52: {chan: 5, send: 2},
  56: {chan: 6, send: 2},
  60: {chan: 7, send: 2},
};
const CC_DEVICE_ENCODERS = Object.keys(CC_ENCODERS).map(Number);

/* ----------------------- BUTTONS ---------------------- */
const CC_SOLO = [16, 17, 18, 19, 20, 21, 22, 23];
const CC_RECO = [100, 101, 102, 103, 104, 105, 106, 107];
const CC_MUTE = [0, 1, 2, 3, 4, 5, 6, 7];

/* ------------------------- LED ------------------------ */
const LED_SOLO = [0x01, 0x04, 0x07, 0x0a, 0x0d, 0x10, 0x13, 0x16];
const LED_MUTE = [0x03, 0x06, 0x09, 0x0c, 0x0f, 0x12, 0x15, 0x18];
const LED_RECO = [0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b]; // ! NOT WORKING ATM

const LED_MAPPING = {
  [SOLO]: LED_SOLO, // row 1
  [MUTE]: LED_MUTE, // row 2
  [RECO]: LED_RECO, // shift + row 1; arm
};

const LED_CACHE = {
  [SOLO]: Array.from({length: MAX_PAGE}, () => new Array(NUM_FADERS).fill(0)),
  [MUTE]: Array.from({length: MAX_PAGE}, () => new Array(NUM_FADERS).fill(0)),
  [RECO]: Array.from({length: MAX_PAGE}, () => new Array(NUM_FADERS).fill(0)),
};

/* ----------------------- FADERS ----------------------- */
const CC_MAIN_FADER = 91;
const CC_CHANNEL_FADERS = [92, 93, 94, 95, 96, 97, 98, 99];

/* ------------------------------------------------------ */
/*                         HELPERS                        */
/* ------------------------------------------------------ */
function isCCRangeMapped(name, cc) {
  var map = CC_BUTTONS[name];
  return cc >= map.lo && cc <= map.hi;
}

function toggleValue(value) {
  return value === 0 ? 127 : 0;
}

function toggle(val) {
  return val === 127 ? 0 : 127;
}

function toBool(val) {
  return val === 127 ? true : false;
}

function handleError(error) {
  println(`${error.name}: ${error.message}`);
  return;
}

function getChannelIndex(index) {
  var page = CHANNEL_PAGE;
  return index + page * NUM_FADERS;
}

function getVolume(value) {
  return Math.min(0.795, value / 127); // 0.795 = -6db
}

/* ------------------------------------------------------ */
/*                     INIT CONTROLLER                    */
/* ------------------------------------------------------ */
function init() {
  // sending to host (bitwig)
  midiIn = host.getMidiInPort(0);
  midiIn.setMidiCallback(onMidi);

  // sending to controller (midimix) -> LED
  midiOut = host.getMidiOutPort(0);

  // 8 channel faders, 3 sends, 0 scenes
  trackBank = host.createMainTrackBank(TRACKS, 2, 0);

  // main fader
  mainFader = host.createMasterTrack(0);

  // cursor track -> cursor device -> remote controls page (third encoder row)
  cursorTrack = host.createCursorTrack(2, 0);
  cursorDevice = cursorTrack.createCursorDevice();
  remoteControls = cursorDevice.createCursorRemoteControlsPage(8);

  // mark all 8 parameters as interested so Bitwig keeps them current
  remoteControls.selectedPageIndex().markInterested();
  remoteControls.pageNames().markInterested();
  for (var i = 0; i < 8; i++) {
    remoteControls.getParameter(i).markInterested();
    remoteControls.getParameter(i).setIndication(true);
  }

  // log page name changes
  remoteControls.selectedPageIndex().addValueObserver(function (index) {
    var names = remoteControls.pageNames().get();
    log("Remote controls page: " + index + " (" + (names[index] || "?") + ")");
  });

  // Subscribe to mute, solo, and arm state for every channel so that:
  //   1. LED_CACHE is populated with the real project state on load.
  //   2. Any subsequent change (e.g. another controller, automation) keeps
  //      the cache — and, for the current page, the physical LEDs — in sync.
  for (var cix = 0; cix < TRACKS; cix++) {
    (function (cix) {
      var page = Math.floor(cix / NUM_FADERS);
      var ledIndex = cix % NUM_FADERS;
      var channel = trackBank.getTrack(cix);

      channel.mute().addValueObserver(function (isMuted) {
        var state = isMuted ? ON : OFF;
        LED_CACHE[MUTE][page][ledIndex] = state;
        if (page === CHANNEL_PAGE) {
          midiOut.sendMidi(NOTE_ON, LED_MAPPING[MUTE][ledIndex], state);
        }
      });

      channel.solo().addValueObserver(function (isSoloed) {
        var state = isSoloed ? ON : OFF;
        LED_CACHE[SOLO][page][ledIndex] = state;
        if (page === CHANNEL_PAGE) {
          midiOut.sendMidi(NOTE_ON, LED_MAPPING[SOLO][ledIndex], state);
        }
      });

      channel.arm().addValueObserver(function (isArmed) {
        var state = isArmed ? ON : OFF;
        LED_CACHE[RECO][page][ledIndex] = state;
        if (page === CHANNEL_PAGE) {
          midiOut.sendMidi(NOTE_ON, LED_MAPPING[RECO][ledIndex], state);
        }
      });
    })(cix);
  }
}

function exit() {
  log("exit()");
}

/* ------------------------------------------------------ */
/*                   MIDI STATUS HANDLER                  */
/* ------------------------------------------------------ */

/* ----------------------- BUTTONS ---------------------- */
function handleChannelButtonPress(cc, value) {
  try {
    // log(`handleChannelButtonPress -> ${status} CH ${cc} : ${value}`);
    switch (true) {
      case cc === BANKL:
        if (SHIFT_PRESSED) {
          cursorDevice.selectPrevious();
          log("SHIFT+BANK LEFT: previous device");
        } else {
          CHANNEL_PAGE = Math.max(MIN_PAGE, CHANNEL_PAGE - 1);
          log(`BANK LEFT, Page: ${CHANNEL_PAGE}`);
          getLEDTracks();
        }
        break;

      case cc === BANKR:
        if (SHIFT_PRESSED) {
          cursorDevice.selectNext();
          log("SHIFT+BANK RIGHT: next device");
        } else {
          CHANNEL_PAGE = Math.min(MAX_PAGE, CHANNEL_PAGE + 1);
          log(`BANK RIGHT, Page: ${CHANNEL_PAGE}`);
          getLEDTracks();
        }
        break;

      case cc === SHIFT:
        SHIFT_PRESSED = cc == SHIFT;
        log(`SHIFT pressed: ${SHIFT_PRESSED}`);
        break;

      case CC_SOLO.includes(cc):
        log("SOLO pressed");
        handleButtonPress(cc, SOLO, value);
        break;

      case CC_MUTE.includes(cc):
        log("MUTE pressed");
        handleButtonPress(cc, MUTE, value);
        break;

      case CC_RECO.includes(cc):
        handleButtonPress(cc, RECO, value);
        log("ARM pressed");
        break;

      default:
        break;
    }

    return;
  } catch (error) {
    handleError(error);
  }
}

/* ----------------------- BUTTONS ---------------------- */
function handleButtonPress(cc, type, value) {
  // select the button type
  let buttons;
  switch (type) {
    case SOLO:
      buttons = CC_SOLO;
      break;
    case MUTE:
      buttons = CC_MUTE;
      break;
    case RECO:
      buttons = CC_RECO;
      break;
  }

  try {
    if (value === ON) {
      // SOLO, MUTE, ARM
      var index = buttons.indexOf(cc);
      var cix = getChannelIndex(index);
      var channel = trackBank.getTrack(cix);
      channel[type].toggle();
      // LED SETTINGS
      toggleLED(type, index);

      // Solo and mute are exclusive: turning one ON turns the other OFF
      if (type === SOLO || type === MUTE) {
        var otherType = type === SOLO ? MUTE : SOLO;
        var newState = LED_CACHE[type][CHANNEL_PAGE][index];
        if (
          newState === ON &&
          LED_CACHE[otherType][CHANNEL_PAGE][index] === ON
        ) {
          trackBank.getTrack(cix)[otherType].toggle();
          setLED(otherType, index, OFF);
        }
      }

      return;
    }

    return;
  } catch (error) {
    handleError(error);
  }
}

function toggleLED(type, index) {
  var led = LED_MAPPING[type][index];
  var value = toggleValue(LED_CACHE[type][CHANNEL_PAGE][index]);
  LED_CACHE[type][CHANNEL_PAGE][index] = value;
  midiOut.sendMidi(NOTE_ON, led, value);
}

function setLED(type, index, value) {
  var led = LED_MAPPING[type][index];
  LED_CACHE[type][CHANNEL_PAGE][index] = value;
  midiOut.sendMidi(NOTE_ON, led, value);
}

function getLED(type, index) {
  var led = LED_MAPPING[type][index];
  var value = LED_CACHE[type][CHANNEL_PAGE][index];
  midiOut.sendMidi(NOTE_ON, led, value);
}

function getLEDTracks() {
  log(`Updating LEDs on PAGE ${CHANNEL_PAGE}`);
  for (let i = 0; i < NUM_FADERS; i++) {
    getLED(SOLO, i);
    getLED(MUTE, i);
    getLED(RECO, i);
  }
}

/* --------------------- MAIN FADER --------------------- */
function handleMainVolume(cc, value) {
  log(`Main Fader -> ${cc} : ${value}`);
  let volume = getVolume(value);
  mainFader.volume().setRaw(volume);
}

/* -------------------- CHANNEL FADER ------------------- */
function handleChannelVolume(cc, value) {
  try {
    var index = CC_CHANNEL_FADERS.indexOf(cc);
    var page = CHANNEL_PAGE;
    var cix = getChannelIndex(index);
    var channel = trackBank.getTrack(cix);
    let volume = getVolume(value);
    log(`Changing volume of channel ${cix} to ${volume} (page: ${page})`);
    channel.volume().setRaw(volume);
    return;
  } catch (error) {
    handleError(error);
  }
}

/* ---------------------- ENCODERS ---------------------- */
function handleEncoder(cc, value) {
  try {
    log(`handleEncoder -> ${cc} : ${value}`);
    var chan_index = CC_SENDS[cc].chan;
    var send_index = CC_SENDS[cc].send;
    var cix = getChannelIndex(chan_index);
    var channel = trackBank.getTrack(cix);
    channel.getSend(send_index).set(value, 128);
    return;
  } catch (error) {
    handleError(error);
  }
}

/* ------------------- DEVICE ENCODERS ----------------- */
function handleDeviceEncoder(cc, value) {
  try {
    log(`handleDeviceEncoder -> ${cc} : ${value}`);
    var index = CC_ENCODERS[cc].chan; // 0-7, maps to parameter slot
    remoteControls.getParameter(index).set(value / 127.0);
    return;
  } catch (error) {
    handleError(error);
  }
}

/* ------------------------------------------------------ */
/*                   MIDI INPUT HANDLER                   */
/* ------------------------------------------------------ */
function onMidi(status, cc, value) {
  // log(`status: ${status}, cc: ${cc}, value: ${value}`);

  switch (true) {
    case isNoteOn(status):
      handleChannelButtonPress(cc, value);
      break;

    case isNoteOff(status):
      if (cc == SHIFT) {
        SHIFT_PRESSED = false
        log(`SHIFT pressed: ${SHIFT_PRESSED}`);
      }
      break;

    case isChannelController(status):
      if (cc === CC_MAIN_FADER) {
        handleMainVolume(cc, value);
        break;
      }

      if (CC_CHANNEL_FADERS.includes(cc)) {
        handleChannelVolume(cc, value);
        break;
      }

      if (CC_SEND_ENCODERS.includes(cc)) {
        handleEncoder(cc, value);
        break;
      }

      if (CC_DEVICE_ENCODERS.includes(cc)) {
        handleDeviceEncoder(cc, value);
        break;
      }

      break;

    default:
      break;
  }
  return;
}
