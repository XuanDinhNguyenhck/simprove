/* FitShow (0xFFF0) binary protocol — pure functions, zero DOM or Web APIs.
   Can be reused unchanged in Web Bluetooth, Capacitor (iOS/Android), or React Native.

   Frame layout:
     [0x02 (STX)] [CMD] [...DATA] [XOR_CHECKSUM] [0x03 (ETX)]
   where XOR_CHECKSUM = CMD ^ DATA[0] ^ ... ^ DATA[n-1]. */

const FitShowProtocol = (() => {
  const SERVICE_UUID     = '0000fff0-0000-1000-8000-00805f9b34fb';
  const CHAR_NOTIFY_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
  const CHAR_WRITE_UUID  = '0000fff2-0000-1000-8000-00805f9b34fb';

  const STX = 0x02;
  const ETX = 0x03;

  const CMD = {
    SYS_INFO:    0x50,
    SYS_STATUS:  0x51,
    SYS_DATA:    0x52,
    SYS_CONTROL: 0x53
  };

  const CONTROL = {
    START_OR_READY: 0x01,
    SET_SPEED:      0x02,
    STOP:           0x03
  };

  const STATE = {
    0x00: { key: 'idle',      label: 'Idle / Ready',       running: false },
    0x01: { key: 'stopped',   label: 'Stopped',            running: false },
    0x02: { key: 'countdown', label: 'Starting Countdown', running: false },
    0x03: { key: 'running',   label: 'Running',            running: true  },
    0x04: { key: 'paused',    label: 'Stopping / Paused',  running: false },
    0x08: { key: 'sleep',     label: 'Sleep Mode',         running: false },
    0x09: { key: 'safety',    label: 'Safety Key Missing', running: false },
    0x0a: { key: 'sleep',     label: 'Sleep / Standby',    running: false }
  };

  function checksum(payload) {
    let xor = 0;
    for (let i = 0; i < payload.length; i++) xor ^= payload[i];
    return xor & 0xff;
  }

  function encodeFrame(payload) {
    const out = new Uint8Array(payload.length + 3);
    out[0] = STX;
    for (let i = 0; i < payload.length; i++) out[i + 1] = payload[i];
    out[payload.length + 1] = checksum(payload);
    out[payload.length + 2] = ETX;
    return out;
  }

  /* ---- Command Builders ---- */

  const cmdPollStatus = () => encodeFrame([CMD.SYS_STATUS]);
  const cmdDeviceInfo = () => encodeFrame([CMD.SYS_INFO, 0x00]);
  const cmdStart      = () => encodeFrame([CMD.SYS_CONTROL, CONTROL.START_OR_READY, 0x00, 0x00, 0x00, 0x00]);
  const cmdStop       = () => encodeFrame([CMD.SYS_CONTROL, CONTROL.STOP]);

  function cmdSetSpeed(kmh, incline = 0) {
    const clamped = Math.max(1.0, Math.min(12.0, Number(kmh) || 1.0));
    const speedX10 = Math.round(clamped * 10) & 0xff;
    const inc = Math.max(0, Math.round(incline)) & 0xff;
    return encodeFrame([CMD.SYS_CONTROL, CONTROL.SET_SPEED, speedX10, inc]);
  }

  /* ---- Frame Parser ---- */

  function parseFrame(rawBytes) {
    const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
    if (bytes.length < 4 || bytes[0] !== STX || bytes[bytes.length - 1] !== ETX) {
      return { valid: false, reason: 'framing', raw: bytes };
    }

    const payload = bytes.subarray(1, bytes.length - 2);
    const expectedXor = bytes[bytes.length - 2];
    const actualXor = checksum(payload);
    const crcOk = expectedXor === actualXor;

    const cmd = payload[0];

    if (cmd === CMD.SYS_STATUS) {
      const stateByte = payload[1] ?? 0x00;
      const stateInfo = STATE[stateByte] || {
        key: 'unknown',
        label: `State 0x${stateByte.toString(16).toUpperCase()}`,
        running: false
      };

      const result = {
        valid: true,
        crcOk,
        type: 'status',
        stateCode: stateByte,
        stateKey: stateInfo.key,
        stateLabel: stateInfo.label,
        running: stateInfo.running,
        speedKmh: 0,
        incline: 0,
        elapsedSec: 0,
        distanceM: 0,
        distanceKm: 0,
        calories: 0,
        steps: 0,
        raw: bytes
      };

      /* Running / Paused telemetry frame contains 12+ bytes */
      if (bytes.length >= 12) {
        result.speedKmh   = bytes[3] / 10.0;
        result.incline    = bytes[4];
        result.elapsedSec = bytes[5] | (bytes[6] << 8);
        result.distanceM  = bytes[7] | (bytes[8] << 8);
        result.distanceKm = result.distanceM / 1000.0;
        result.calories   = bytes[9] | (bytes[10] << 8);
        if (bytes.length >= 14) {
          result.steps = bytes[11] | (bytes[12] << 8);
        }
      }
      return result;
    }

    return {
      valid: true,
      crcOk,
      type: cmd === CMD.SYS_INFO ? 'info' : cmd === CMD.SYS_CONTROL ? 'control_ack' : 'other',
      cmd,
      payload,
      raw: bytes
    };
  }

  /* ---- Hex helpers ---- */

  const toHex = bytes =>
    Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

  function fromHex(hexStr) {
    const clean = String(hexStr).replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  return {
    SERVICE_UUID,
    CHAR_NOTIFY_UUID,
    CHAR_WRITE_UUID,
    CMD,
    STATE,
    checksum,
    encodeFrame,
    cmdPollStatus,
    cmdDeviceInfo,
    cmdStart,
    cmdStop,
    cmdSetSpeed,
    parseFrame,
    toHex,
    fromHex
  };
})();
