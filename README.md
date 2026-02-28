# Akai MIDImix — Bitwig Studio Controller Script

A full-featured Bitwig Studio controller script for the **Akai MIDImix**, with LED feedback, multi-page track banking, device control, and on-screen notifications.

---

## Hardware Layout

```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │  ← Send 1
│ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │  ← Send 2
│ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │ ENC │  ← Device Parameters
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│SOLO │SOLO │SOLO │SOLO │SOLO │SOLO │SOLO │SOLO │  ← Solo buttons (LED row 1)
│MUTE │MUTE │MUTE │MUTE │MUTE │MUTE │MUTE │MUTE │  ← Mute buttons (LED row 2)
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ FAD │ FAD │ FAD │ FAD │ FAD │ FAD │ FAD │ FAD │  ← Channel faders
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                                          [ MASTER ]  ← Master fader

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

## Controls

### Faders

| Control | Function |
|---|---|
| Channel faders (×8) | Channel volume (capped at −6 dB) |
| Master fader | Master track volume (capped at −6 dB) |

### Encoders

Each channel has **three encoders** stacked vertically:

| Row | Function |
|---|---|
| Top | Send 1 level for that channel |
| Middle | Send 2 level for that channel |
| Bottom | Device remote control parameter (mapped in Bitwig's Remote Controls editor) |

### Solo & Mute Buttons

| Button | Function |
|---|---|
| **SOLO** | Toggle solo for that channel |
| **MUTE** | Toggle mute for that channel |

Solo and mute are **mutually exclusive** — enabling one automatically disables the other on the same channel.

The **SOLO LED** lights up when the channel is soloed.
The **MUTE LED** lights up when the channel is muted.

### BANK L / BANK R

Navigate through **channel pages**. Each page covers 8 tracks, and up to **160 tracks** (20 pages) are supported.

| Button | Function |
|---|---|
| **BANK L** | Previous page of 8 channels |
| **BANK R** | Next page of 8 channels |

Both buttons light up while held as tactile confirmation.

---

## SHIFT Button

Hold **SHIFT** to unlock a second layer of functionality. While SHIFT is held:

- The **MUTE row LEDs switch** to show the current record arm state of each channel.
- Channels 1 and 2 of the MUTE row **always light up** as a hint that those buttons navigate device pages.

| SHIFT + … | Function |
|---|---|
| **MUTE button** (any channel) | Toggle record arm for that channel. Only works on tracks that support arming (audio/instrument). |
| **BANK L** | Select the **previous device** on the currently focused track |
| **BANK R** | Select the **next device** on the currently focused track |
| **Channel 1 bottom button** | Go to the **previous remote controls page** of the current device |
| **Channel 2 bottom button** | Go to the **next remote controls page** of the current device |

> **Note:** SHIFT + SOLO does nothing — solo is only available without SHIFT.

When SHIFT is released, all LEDs return to their normal SOLO / MUTE state.

---

## LED Behaviour Summary

| LED | Normal | While SHIFT held |
|---|---|---|
| Row 1 (SOLO) | Lit when channel is soloed | Unchanged |
| Row 2 (MUTE) | Lit when channel is muted | Shows record arm state |
| Ch 1 & 2 MUTE LEDs | Mute state | Always lit (device page nav hint) |
| BANK L / BANK R | Off | Lit while physically pressed |

On script load, a **startup LED sweep** animation runs across both rows, then restores the actual project state.

---

## On-Screen Notifications

Bitwig shows a small popup notification when you interact with the controller:

| Action | Notification example |
|---|---|
| Move a channel fader | `Ch 3 Volume: −12.0 dB` |
| Move the master fader | `Master Volume: −6.0 dB` |
| Turn a send encoder | `Ch 1 Send 2: 45%` |
| Turn a device encoder | `Cutoff: 880 Hz` |
| Change device page | `Device Page: Filter` |
| Switch device | `Device: Reverb` |
| Change channel page | `Channel Page → 3` |
| Press SHIFT | Quick hint of available SHIFT actions |

---

## Developer Options

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `true` | Print MIDI and state info to the Bitwig Script Console |
| `NOTIFICATIONS` | `true` | Show popup notifications in Bitwig on every interaction |

> **Tip:** You can toggle these at runtime without editing the file. Open the **Controller Script Console** in Bitwig Studio (**Settings → Controllers → your controller → Show Console**) and type e.g. `DEBUG = false` or `NOTIFICATIONS = false` directly into the input field.

---

## License

MIT
