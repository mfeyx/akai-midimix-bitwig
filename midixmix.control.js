loadAPI(18);

host.defineController(
  "Akai",
  "Akai Midimix",
  "1.1",
  "7b8cd61c-2718-4d77-80b5-a2103f92b69c",
  "mfeyx",
);
host.addDeviceNameBasedDiscoveryPair(["MIDI Mix"], ["MIDI Mix"]);
host.defineMidiPorts(1, 1);

/* ------------------------------------------------------ */
/*                    DEBUGGING FEATURE                   */
/* ------------------------------------------------------ */
var DEBUG = true;

function midi(cc, on = true) {
  var value = on ? ON : OFF
  midiOut.sendMidi(NOTE_ON, cc, value);
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
/*                     NOTIFICATIONS                      */
/* ------------------------------------------------------ */
var NOTIFICATIONS = true;

function notify(msg) {
  if (NOTIFICATIONS) {
    host.showPopupNotification(msg);
  }
}

/* ------------------------------------------------------ */
/*                       MIDI SPECS                       */
/* ------------------------------------------------------ */
const ON = 127;
const OFF = 0;

const NOTE_ON = 0x90; // 144
const NOTE_OFF = 0x80;
/* ------------------------------------------------------ */
/*                          NAMES                         */
/* ------------------------------------------------------ */
// do not change those values,
// they are called like the api methods, e.g. channel.solo()
const SOLO = "solo";
const MUTE = "mute";
const ARM = "arm";

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
var SHIFT_PRESS_TIME = 0;
var SHIFT_ACTION_TAKEN = false;
const SHIFT_SHORT_PRESS_MS = 300; // ms: shorter than this = short press

// 1 = Mixer Mode, 2 = Track Mode, 3 = Device Mode
var PROGRAM_MODE = 1;

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
const CC_MUTE = [0, 1, 2, 3, 4, 5, 6, 7];
const CC_ARM = [100, 101, 102, 103, 104, 105, 106, 107];

/* ------------------------- LED ------------------------ */
const LED_SOLO = [0x01, 0x04, 0x07, 0x0a, 0x0d, 0x10, 0x13, 0x16];
const LED_MUTE = [0x03, 0x06, 0x09, 0x0c, 0x0f, 0x12, 0x15, 0x18];

const LED_MAPPING = {
  [SOLO]: LED_SOLO, // row 1
  [MUTE]: LED_MUTE, // row 2
  [ARM]:  LED_MUTE, // same physical LEDs as MUTE; shown when SHIFT is held
};

const LED_CACHE = {
  [SOLO]: Array.from({length: MAX_PAGE}, () => new Array(NUM_FADERS).fill(0)),
  [MUTE]: Array.from({length: MAX_PAGE}, () => new Array(NUM_FADERS).fill(0)),
  [ARM]: Array.from({length: MAX_PAGE}, () => new Array(NUM_FADERS).fill(0)),
};

/* ----------------------- FADERS ----------------------- */
const CC_MAIN_FADER = 91;
const CC_CHANNEL_FADERS = [92, 93, 94, 95, 96, 97, 98, 99];

/* ------------------------------------------------------ */
/*                         HELPERS                        */
/* ------------------------------------------------------ */
function toggleValue(value) {
  return value === 0 ? 127 : 0;
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

function rawToDb(raw) {
  if (raw <= 0) return "-∞ dB";
  return (60 * Math.log10(raw)).toFixed(1) + " dB";
}

/* ------------------------------------------------------ */
/*                    PROGRAM MODE LEDs                   */
/* ------------------------------------------------------ */

// Which SOLO indices are active buttons in each non-Mixer mode
const TRACK_MODE_SOLO_ACTIVE  = [0, 1, 2, 3];
const DEVICE_MODE_SOLO_ACTIVE = [0, 1, 2, 3, 6, 7];

function updateProgramModeLEDs() {
  switch (PROGRAM_MODE) {
    case 1: // Mixer: both bank LEDs off; restore SOLO row from cache
      midiOut.sendMidi(NOTE_ON, BANKL, OFF);
      midiOut.sendMidi(NOTE_ON, BANKR, OFF);
      for (var i = 0; i < NUM_FADERS; i++) {
        getLED(SOLO, i);
      }
      break;

    case 2: // Track: BANKL on, BANKR off; light up active SOLO buttons
      midiOut.sendMidi(NOTE_ON, BANKL, ON);
      midiOut.sendMidi(NOTE_ON, BANKR, OFF);
      for (var i = 0; i < NUM_FADERS; i++) {
        var isActive = TRACK_MODE_SOLO_ACTIVE.includes(i);
        midiOut.sendMidi(NOTE_ON, LED_SOLO[i], isActive ? ON : OFF);
      }
      break;

    case 3: // Device: BANKL off, BANKR on; light up active SOLO buttons
      midiOut.sendMidi(NOTE_ON, BANKL, OFF);
      midiOut.sendMidi(NOTE_ON, BANKR, ON);
      for (var i = 0; i < NUM_FADERS; i++) {
        var isActive = DEVICE_MODE_SOLO_ACTIVE.includes(i);
        midiOut.sendMidi(NOTE_ON, LED_SOLO[i], isActive ? ON : OFF);
      }
      break;
  }
}

/* ------------------------------------------------------ */
/*                   STARTUP LED ANIMATION                */
/* ------------------------------------------------------ */
function ledStartupAnimation() {
  var STEP = 60; // ms between each channel column

  // Phase 1: sweep ON left-to-right — SOLO first, MUTE half a step later
  for (var i = 0; i < NUM_FADERS; i++) {
    (function (i) {
      host.scheduleTask(function () {
        midiOut.sendMidi(NOTE_ON, LED_SOLO[i], ON);
      }, i * STEP);
      host.scheduleTask(function () {
        midiOut.sendMidi(NOTE_ON, LED_MUTE[i], ON);
      }, i * STEP + STEP / 2);
    })(i);
  }

  // Phase 2: sweep OFF left-to-right — same cadence
  var phase2 = NUM_FADERS * STEP + STEP; // start after a short pause
  for (var i = 0; i < NUM_FADERS; i++) {
    (function (i) {
      host.scheduleTask(function () {
        midiOut.sendMidi(NOTE_ON, LED_SOLO[i], OFF);
      }, phase2 + i * STEP);
      host.scheduleTask(function () {
        midiOut.sendMidi(NOTE_ON, LED_MUTE[i], OFF);
      }, phase2 + i * STEP + STEP / 2);
    })(i);
  }

  // Phase 3: restore actual project state from the cache
  var phase3 = phase2 + NUM_FADERS * STEP + STEP;
  host.scheduleTask(function () {
    getLEDTracks();
    updateProgramModeLEDs();
  }, phase3);
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
    remoteControls.getParameter(i).name().markInterested();
    remoteControls.getParameter(i).displayedValue().markInterested();
  }

  // log page name changes
  remoteControls.selectedPageIndex().addValueObserver(function (index) {
    var names = remoteControls.pageNames().get();
    var name = names[index] || "?";
    if (name !== "?") {
      log("Remote controls page: " + index + " (" + name + ")");
      notify("Device Page: " + name);
    }
  });

  // notify whenever the selected device changes
  cursorDevice.name().markInterested();
  cursorDevice.name().addValueObserver(function (name) {
    if (name) {
      log("Device: " + name);
      notify("Device: " + name);
    }
  });

  // notify whenever the selected track changes
  cursorTrack.name().markInterested();
  cursorTrack.name().addValueObserver(function (name) {
    if (name) {
      log("Track: " + name);
      notify("Track: " + name);
    }
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
        if (page === CHANNEL_PAGE && SHIFT_PRESSED) {
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
        LED_CACHE[ARM][page][ledIndex] = state;
        if (page === CHANNEL_PAGE && !SHIFT_PRESSED) {
          midiOut.sendMidi(NOTE_ON, LED_MAPPING[ARM][ledIndex], state);
        }
      });
    })(cix);
  }

  ledStartupAnimation();
}

function exit() {
  log("exit()");
}

/* ------------------------------------------------------ */
/*                   MIDI STATUS HANDLER                  */
/* ------------------------------------------------------ */

/* ------------- UNIVERSAL BUTTON DISPATCHER ------------ */
function handleChannelButtonPress(cc, value) {
  try {
    // SHIFT press — always handled regardless of mode
    if (cc === SHIFT) {
      SHIFT_PRESSED = true;
      SHIFT_PRESS_TIME = Date.now();
      SHIFT_ACTION_TAKEN = false;
      log("SHIFT pressed");
      for (let i = 0; i < NUM_FADERS; i++) {
        getLED(MUTE, i);
      }
      return;
    }

    // BANKL / BANKR — always handled regardless of mode
    if (cc === BANKL) {
      midiOut.sendMidi(NOTE_ON, BANKL, ON);
      if (SHIFT_PRESSED) {
        SHIFT_ACTION_TAKEN = true;
        cursorDevice.selectPrevious();
        log("SHIFT+BANKL: previous device");
      } else {
        CHANNEL_PAGE = Math.max(MIN_PAGE, CHANNEL_PAGE - 1);
        log(`BANKL, Page: ${CHANNEL_PAGE}`);
        notify(`Channel Page ← ${CHANNEL_PAGE + 1}`);
        getLEDTracks();
      }
      return;
    }

    if (cc === BANKR) {
      midiOut.sendMidi(NOTE_ON, BANKR, ON);
      if (SHIFT_PRESSED) {
        SHIFT_ACTION_TAKEN = true;
        cursorDevice.selectNext();
        log("SHIFT+BANKR: next device");
      } else {
        CHANNEL_PAGE = Math.min(MAX_PAGE, CHANNEL_PAGE + 1);
        log(`BANKR, Page: ${CHANNEL_PAGE}`);
        notify(`Channel Page → ${CHANNEL_PAGE + 1}`);
        getLEDTracks();
      }
      return;
    }

    // Dispatch to the active mode handler
    switch (PROGRAM_MODE) {
      case 1: handleMixerMode(cc, value);  break;
      case 2: handleTrackMode(cc, value);  break;
      case 3: handleDeviceMode(cc, value); break;
    }
  } catch (error) {
    handleError(error);
  }
}

/* ------------------- MODE 1: MIXER -------------------- */
function handleMixerMode(cc, value) {
  // SOLO row — toggle solo
  if (CC_SOLO.includes(cc)) {
    if (!SHIFT_PRESSED) {
      log("[Mixer] SOLO pressed");
      handleButtonPress(cc, SOLO, value);
    }
    return;
  }

  // MUTE row — ARM normally; SHIFT+MUTE = mute
  if (CC_MUTE.includes(cc)) {
    if (SHIFT_PRESSED) {
      SHIFT_ACTION_TAKEN = true;
      log("[Mixer] SHIFT+MUTE: toggle mute");
      handleButtonPress(cc, MUTE, value);
    } else {
      log("[Mixer] ARM pressed");
      var muteIndex = CC_MUTE.indexOf(cc);
      handleButtonPress(CC_ARM[muteIndex], ARM, value);
    }
    return;
  }

  // ARM row — SHIFT+ARM = mute the channel; no other function in Mixer mode
  if (CC_ARM.includes(cc) && value === ON) {
    if (SHIFT_PRESSED) {
      SHIFT_ACTION_TAKEN = true;
      var armIndex = CC_ARM.indexOf(cc);
      var cix = getChannelIndex(armIndex);
      trackBank.getTrack(cix).mute().toggle();
      log(`[Mixer] SHIFT+ARM[${armIndex}]: mute channel ${cix}`);
    }
  }
}

/* ------------------- MODE 2: TRACK -------------------- */
function handleTrackMode(cc, value) {
  if (!CC_SOLO.includes(cc) || value !== ON) return;

  if (cc === CC_SOLO[0]) {
    cursorTrack.selectPrevious();
    log("[Track] Track: previous");
  } else if (cc === CC_SOLO[1]) {
    cursorTrack.selectNext();
    log("[Track] Track: next");
  }
  else if (cc === CC_SOLO[2]) {
    CHANNEL_PAGE = Math.max(MIN_PAGE, CHANNEL_PAGE - 1);
    log(`[Track] Track Bank: page ${CHANNEL_PAGE}`);
    notify(`Channel Page ← ${CHANNEL_PAGE + 1}`);
  } else if (cc === CC_SOLO[3]) {
    CHANNEL_PAGE = Math.min(MAX_PAGE, CHANNEL_PAGE + 1);
    log(`[Track] Track Bank: page ${CHANNEL_PAGE}`);
    notify(`Channel Page → ${CHANNEL_PAGE + 1}`);
  }
}

/* ------------------ MODE 3: DEVICE -------------------- */
function handleDeviceMode(cc, value) {
  if (!CC_SOLO.includes(cc) || value !== ON) return;

  if (cc === CC_SOLO[0]) {
    cursorDevice.selectPrevious();
    log("[Device] Device: previous");
  } else if (cc === CC_SOLO[1]) {
    cursorDevice.selectNext();
    log("[Device] Device: next");
  } else if (cc === CC_SOLO[2]) {
    remoteControls.selectPreviousPage(false);
    log("[Device] Device page: previous");
  } else if (cc === CC_SOLO[3]) {
    remoteControls.selectNextPage(false);
    log("[Device] Device page: next");
  } else if (cc === CC_SOLO[6]) {
    cursorDevice.isExpanded().toggle();
    log("[Device] Toggle device expanded");
  } else if (cc === CC_SOLO[7]) {
    cursorDevice.isRemoteControlsSectionVisible().toggle();
    log("[Device] Toggle remote controls visibility");
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
    case ARM:
      buttons = CC_ARM;
      break;
  }

  try {
    if (value === ON) {
      // SOLO, MUTE, ARM
      var index = buttons.indexOf(cc);
      var cix = getChannelIndex(index);
      var channel = trackBank.getTrack(cix);
      channel[type].toggle();
      // LED SETTINGS — ARM LED is driven solely by the value observer,
      // so we only optimistically toggle for SOLO and MUTE. This prevents
      // the ARM LED from flipping when the track cannot actually be armed.
      if (type !== ARM) {
        toggleLED(type, index);
      }

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
    }
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
    // MUTE and ARM share the same physical LEDs — show whichever is active
    if (SHIFT_PRESSED) {
      getLED(MUTE, i);
    } else {
      getLED(ARM, i);
    }
  }
}

/* --------------------- MAIN FADER --------------------- */
function handleMainVolume(cc, value) {
  log(`Main Fader -> ${cc} : ${value}`);
  const volume = getVolume(value);
  mainFader.volume().setRaw(volume);
  notify(`Master Volume: ${rawToDb(volume)}`);
}

/* -------------------- CHANNEL FADER ------------------- */
function handleChannelVolume(cc, value) {
  try {
    const index = CC_CHANNEL_FADERS.indexOf(cc);
    const cix = getChannelIndex(index);
    const volume = getVolume(value);
    log(`Changing volume of channel ${cix} to ${volume}`);
    trackBank.getTrack(cix).volume().setRaw(volume);
    notify(`Ch ${cix + 1} Volume: ${rawToDb(volume)}`);
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
    notify(`Ch ${cix + 1} Send ${send_index + 1}: ${Math.round(value / 127 * 100)}%`);
  } catch (error) {
    handleError(error);
  }
}

/* ------------------- DEVICE ENCODERS ----------------- */
function handleDeviceEncoder(cc, value) {
  try {
    log(`handleDeviceEncoder -> ${cc} : ${value}`);
    var index = CC_ENCODERS[cc].chan; // 0-7, maps to parameter slot
    var param = remoteControls.getParameter(index);
    param.set(value / 127.0);
    var paramName = param.name().get() || `Param ${index + 1}`;
    var paramValue = param.displayedValue().get();
    notify(`${paramName}: ${paramValue}`);
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
        var pressDuration = Date.now() - SHIFT_PRESS_TIME;
        if (!SHIFT_ACTION_TAKEN && pressDuration < SHIFT_SHORT_PRESS_MS) {
          // Short press: cycle to the next program mode (1 → 2 → 3 → 1)
          PROGRAM_MODE = (PROGRAM_MODE % 3) + 1;
          var modeNames = ['', 'Mixer', 'Track', 'Device'];
          log(`Program Mode: ${PROGRAM_MODE} (${modeNames[PROGRAM_MODE]})`);
          notify(`Mode: ${modeNames[PROGRAM_MODE]}`);
        }
        SHIFT_PRESSED = false;
        log(`SHIFT released (held ${pressDuration}ms)`);
        // Switch MUTE-row LEDs back to ARM state
        for (let i = 0; i < NUM_FADERS; i++) {
          getLED(ARM, i);
        }
        // Restore BANK LEDs to reflect current program mode
        updateProgramModeLEDs();
      } else if (cc === BANKL) {
        // Keep BANKL LED on if in Track Mode (mode 2), else off
        midiOut.sendMidi(NOTE_ON, BANKL, PROGRAM_MODE === 2 ? ON : OFF);
      } else if (cc === BANKR) {
        // Keep BANKR LED on if in Device Mode (mode 3), else off
        midiOut.sendMidi(NOTE_ON, BANKR, PROGRAM_MODE === 3 ? ON : OFF);
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
