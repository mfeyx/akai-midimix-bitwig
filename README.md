# Akai MIDImix — Bitwig Studio Controller Script

A full-featured Bitwig Studio controller script for the **Akai MIDImix**, with LED feedback, multi-page track banking, four program modes, scene launching, device control, and on-screen notifications.

---

## Hardware Layout

> **Heads up: Custom Hardware Layout**
>
> This script uses a **custom MIDI preset** (`bitwig.midimix`) that differs from the Akai MIDImix factory defaults. You must load this preset via the Akai MidiMix Editor before use. The button rows have been remapped:
>
> | Physical label on hardware | Factory function | This script |
> |---|---|---|
> | Button Row 1 | Mute / Solo | **Solo** |
> | Button Row 2 | Rec Arm | **Mute / ARM (context-dependent)** |
> | Right panel SOLO button | Solo | **SHIFT** |
> | SHIFT + Button Row 2 | n/a | **Rec Arm** |
>
> Without the custom preset, buttons will not behave as documented.

```
+-----+-----+-----+-----+-----+-----+-----+-----+
| ENC | ENC | ENC | ENC | ENC | ENC | ENC | ENC |  <- Send 1
| ENC | ENC | ENC | ENC | ENC | ENC | ENC | ENC |  <- Send 2
| ENC | ENC | ENC | ENC | ENC | ENC | ENC | ENC |  <- Device Parameters
+-----+-----+-----+-----+-----+-----+-----+-----+
|SOLO |SOLO |SOLO |SOLO |SOLO |SOLO |SOLO |SOLO |  <- Button row 1 (LED row 1)
| ARM | ARM | ARM | ARM | ARM | ARM | ARM | ARM |  <- Button row 2 (LED row 2)
+-----+-----+-----+-----+-----+-----+-----+-----+
| FAD | FAD | FAD | FAD | FAD | FAD | FAD | FAD |  <- Channel faders
+-----+-----+-----+-----+-----+-----+-----+-----+
                                        [ MASTER ]  <- Master fader

Right panel:  [ BANK L ]  [ BANK R ]  [ SHIFT ]
```

---

## Installation

1. Load the `bitwig.midimix` preset file into the **Akai MidiMix Editor** and send it to the hardware.
2. Copy the `akai-midimix-bitwig` folder into your Bitwig Studio controller scripts directory:
   - **macOS:** `~/Documents/Bitwig Studio/Controller Scripts/`
   - **Windows:** `%USERPROFILE%\Documents\Bitwig Studio\Controller Scripts\`
3. In Bitwig Studio go to **Settings → Controllers → Add controller manually** and select **Akai → Akai Midimix**.
4. Set both MIDI input and output to **MIDI Mix**.

---

## Program Modes

The script has **four program modes**. A **short press of SHIFT** (< 400 ms) cycles through them:

```
Mixer → Track → Device → Project → Mixer → ...
```

The active mode is indicated by the **BANK L / BANK R LEDs**:

| Mode | BANK L | BANK R |
|---|---|---|
| **Mixer** | Off | Off |
| **Track** | On | Off |
| **Device** | Off | On |
| **Project** | On | On |

---

## Faders (all modes)

| Control | Function |
|---|---|
| Channel faders (x8) | Channel volume (capped at -6 dB) |
| Master fader | Master track volume (capped at -6 dB) |

---

## Encoders (all modes)

Each channel has **three encoders** stacked vertically:

| Row | Function |
|---|---|
| Top | Send 1 level for that channel |
| Middle | Send 2 level for that channel |
| Bottom | Device remote control parameter (current page, mapped in Bitwig's Remote Controls editor) |

The active remote control parameters are shown as a **highlighted bar** at the bottom of the Bitwig UI — visible in all modes and bound to the cursor device on the selected track.

---

## Mode 1 — Mixer Mode

Default mode. Full mixing control with LED feedback.

### Button Row 1 (SOLO)

| Button | Function |
|---|---|
| SOLO 1–8 | Toggle solo for that channel |

### Button Row 2 (ARM/MUTE)

| Button | Normal | While SHIFT held |
|---|---|---|
| ARM 1–8 | Toggle rec arm | Toggle mute |

Solo and mute are **mutually exclusive** — enabling one automatically disables the other on the same channel.

### BANK L / BANK R

| Button | Normal | While SHIFT held |
|---|---|---|
| **BANK L** | Previous page of 8 channels | Select previous device |
| **BANK R** | Next page of 8 channels | Select next device |

Up to **160 tracks** (20 pages x 8 channels) are supported.

---

## Mode 2 — Track Mode

Focus on track navigation. BANK L LED is lit.

### Button Row 1 (SOLO)

| Button | Function |
|---|---|
| SOLO 1 | Select previous track |
| SOLO 2 | Select next track |
| SOLO 3 | Previous channel page (-8 tracks) |
| SOLO 4 | Next channel page (+8 tracks) |
| SOLO 5–8 | (unused) |

---

## Mode 3 — Device Mode

Navigate and control devices on the selected track. BANK R LED is lit.

### Button Row 1 (SOLO)

| Button | Function |
|---|---|
| SOLO 1 | Select previous device in chain |
| SOLO 2 | Select next device in chain |
| SOLO 3 | Previous remote controls page |
| SOLO 4 | Next remote controls page |
| SOLO 5 | (unused) |
| **SOLO 6** | Focus/toggle Device Panel in Bitwig UI |
| **SOLO 7** | Toggle expanded device view |
| **SOLO 8** | Toggle remote controls section visibility |

### BANK L / BANK R (while SHIFT held)

| Button | Function |
|---|---|
| **BANK L** | Select previous device |
| **BANK R** | Select next device |

---

## Mode 4 — Project Mode

Scene launching and transport/view control. Both BANK LEDs are lit. A **colored bracket** appears in the Bitwig clip launcher UI showing the active scene window.

### Button Row 2 (ARM) — Scene Launcher

| Button | Function |
|---|---|
| ARM 1–6 | Launch scene 1–6 (LED lit when scene exists) |
| ARM 7 | (unused) |
| **ARM 8** | **If playing:** Stop all clips + stop transport<br>**If stopped:** Jump to loop start (if loop active) or project start (beat 0) |

### Button Row 1 (SOLO) — View & Transport

| Button | Function |
|---|---|
| **SOLO 1** | Switch to Arrange layout |
| **SOLO 2** | Switch to Mix layout |
| **SOLO 3** | Toggle Clip Editor panel |
| SOLO 4 | (unused) |
| **SOLO 5** | Toggle arranger loop on/off (LED reflects loop state) |
| SOLO 6 | (unused) |
| **SOLO 7** | Toggle Clip Launcher panel visibility |
| **SOLO 8** | Toggle Arranger Timeline panel visibility |

### BANK L / BANK R — Scene Scrolling

| Button | Function |
|---|---|
| **BANK L** | Scroll scene bank up (bracket moves up in UI) |
| **BANK R** | Scroll scene bank down (bracket moves down in UI) |

---

## SHIFT Button

A **short press** (< 400 ms) of SHIFT cycles to the next program mode.

**Holding** SHIFT unlocks a second function layer without switching modes:

- The **ARM row LEDs** switch to show the current **mute state** of each channel.
- **BANK L / BANK R** navigate devices instead of channel pages (all modes).

| SHIFT + ... | Function |
|---|---|
| **ARM button** (any channel) | Toggle mute for that channel |
| **BANK L** | Select previous device on the focused track |
| **BANK R** | Select next device on the focused track |

When SHIFT is released, all LEDs return to the normal state for the active mode.

---

## LED Behaviour Summary

| LED | Mixer Mode | Track Mode | Device Mode | Project Mode |
|---|---|---|---|---|
| Row 1 (SOLO) | Channel solo state | Ch 1–4 lit | Ch 1–4, 6–8 lit | Ch 1–3, 7–8 lit; Ch 5 = loop state |
| Row 2 (ARM) | Channel arm state | Channel arm state | Channel arm state | Scene existence (1–6); Ch 8 always lit |
| BANK L | Off | On | Off | On |
| BANK R | Off | Off | On | On |

On script load, a **startup LED sweep** animation runs across both rows, then restores the actual project state.

---

## On-Screen Notifications

| Action | Notification example |
|---|---|
| Move a channel fader | `Ch 3 Volume: -12.0 dB` |
| Move the master fader | `Master Volume: -6.0 dB` |
| Turn a send encoder | `Ch 1 Send 2: 45%` |
| Turn a device encoder | `Cutoff: 880 Hz` |
| Change channel page | `Channel Page -> 3` |
| Switch device | `Device: Reverb` |
| Change device page | `Device Page: Filter` |
| Select a track | `Track: Bass` |
| Switch program mode | `Mode: Device` |
| Stop transport (while stopped) | `Loop Start` / `Project Start` |

---

## Developer Options

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `true` | Print MIDI and state info to the Bitwig Script Console |
| `NOTIFICATIONS` | `true` | Show popup notifications in Bitwig on every interaction |

> **Tip:** Toggle these at runtime via the **Controller Script Console** in Bitwig Studio (**Settings → Controllers → your controller → Show Console**) by typing e.g. `DEBUG = false`.

---

## License

GNU GENERAL PUBLIC LICENSE
