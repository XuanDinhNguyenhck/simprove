/* BLE Transport Adapter for FitShow / ZIPRO Newlite.
   Automatically uses Capacitor BluetoothLe plugin when running inside a native
   iOS/Android app wrapper, or Web Bluetooth API when running in a browser. */

const TreadmillBLE = (() => {
  const SERVICE_SHORT = 0xfff0;
  const NOTIFY_SHORT  = 0xfff1;
  const WRITE_SHORT   = 0xfff2;

  let device      = null;
  let notifyChar  = null;
  let writeChar   = null;
  let pollTimer   = null;
  let autoPoll    = true;
  let isConnected = false;

  const frameListeners = [];
  const stateListeners = [];
  const logListeners   = [];

  const emitLog   = (msg, dir = 'info') => logListeners.forEach(fn => fn(msg, dir));
  const emitState = (connected, name, err) => stateListeners.forEach(fn => fn({ connected, name, error: err }));
  const emitFrame = (parsed) => frameListeners.forEach(fn => fn(parsed));

  function hasCapacitorBle() {
    return Boolean(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothLe);
  }

  async function connect() {
    if (hasCapacitorBle()) {
      return connectCapacitor();
    }
    return connectWebBluetooth();
  }

  /* ---- Browser / Android Chrome / Desktop Chrome ---- */
  async function connectWebBluetooth() {
    if (!navigator.bluetooth) {
      const msg = 'Web Bluetooth not supported here. Use Chrome/Edge (Android/PC) or Bluefy on iOS, or package with Capacitor.';
      emitLog(msg, 'err');
      emitState(false, null, msg);
      return false;
    }

    try {
      emitLog('Scanning for FitShow / ZIPRO device…', 'info');
      device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [SERVICE_SHORT] },
          { namePrefix: 'FS-' },
          { namePrefix: 'ZIPRO' }
        ],
        optionalServices: [SERVICE_SHORT, 0x1826]
      });

      device.addEventListener('gattserverdisconnected', handleDisconnect);
      const server  = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_SHORT);
      notifyChar    = await service.getCharacteristic(NOTIFY_SHORT);

      try {
        writeChar = await service.getCharacteristic(WRITE_SHORT);
      } catch (_) {
        writeChar = notifyChar;
        emitLog('0xFFF2 not exposed; using 0xFFF1 for both Notify and Write.', 'info');
      }

      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', ev => {
        const bytes = new Uint8Array(ev.target.value.buffer);
        handleIncomingBytes(bytes);
      });

      isConnected = true;
      const devName = device.name || 'ZIPRO Newlite';
      emitLog(`Connected to ${devName}`, 'info');
      emitState(true, devName, null);

      await send(FitShowProtocol.cmdPollStatus(), 'Poll');
      if (autoPoll) startPolling();
      return true;
    } catch (err) {
      emitLog(`Connect failed: ${err.message}`, 'err');
      emitState(false, null, err.message);
      return false;
    }
  }

  /* ---- Native iOS & Android via @capacitor-community/bluetooth-le ---- */
  async function connectCapacitor() {
    const BleClient = window.Capacitor.Plugins.BluetoothLe;
    try {
      await BleClient.initialize();
      const dev = await BleClient.requestDevice({
        services: [FitShowProtocol.SERVICE_UUID],
        optionalServices: [FitShowProtocol.SERVICE_UUID]
      });
      device = dev;
      await BleClient.connect({ deviceId: dev.deviceId });

      await BleClient.startNotifications({
        deviceId: dev.deviceId,
        service: FitShowProtocol.SERVICE_UUID,
        characteristic: FitShowProtocol.CHAR_NOTIFY_UUID
      }, value => {
        const bytes = new Uint8Array(value.value.buffer);
        handleIncomingBytes(bytes);
      });

      isConnected = true;
      const devName = dev.name || 'ZIPRO Newlite';
      emitLog(`Connected (Native BLE) to ${devName}`, 'info');
      emitState(true, devName, null);

      await send(FitShowProtocol.cmdPollStatus(), 'Poll');
      if (autoPoll) startPolling();
      return true;
    } catch (err) {
      emitLog(`Native BLE error: ${err.message}`, 'err');
      emitState(false, null, err.message);
      return false;
    }
  }

  function handleIncomingBytes(bytes) {
    emitLog(`RX: ${FitShowProtocol.toHex(bytes)}`, 'rx');
    const parsed = FitShowProtocol.parseFrame(bytes);
    if (parsed.valid) emitFrame(parsed);
  }

  function handleDisconnect() {
    stopPolling();
    isConnected = false;
    notifyChar  = null;
    writeChar   = null;
    emitLog('Disconnected from treadmill.', 'err');
    emitState(false, null, null);
  }

  async function disconnect() {
    stopPolling();
    if (hasCapacitorBle() && device && device.deviceId) {
      await window.Capacitor.Plugins.BluetoothLe.disconnect({ deviceId: device.deviceId });
      handleDisconnect();
      return;
    }
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
  }

  async function send(bytes, label = '') {
    if (!isConnected) return false;
    try {
      if (hasCapacitorBle() && device && device.deviceId) {
        await window.Capacitor.Plugins.BluetoothLe.write({
          deviceId: device.deviceId,
          service: FitShowProtocol.SERVICE_UUID,
          characteristic: FitShowProtocol.CHAR_WRITE_UUID,
          value: FitShowProtocol.toHex(bytes).replace(/\s+/g, '')
        });
      } else if (writeChar) {
        await writeChar.writeValue(bytes);
      }
      emitLog(`TX${label ? ' (' + label + ')' : ''}: ${FitShowProtocol.toHex(bytes)}`, 'tx');
      return true;
    } catch (err) {
      emitLog(`Write error: ${err.message}`, 'err');
      return false;
    }
  }

  function startPolling(intervalMs = 1000) {
    stopPolling();
    if (!isConnected) return;
    pollTimer = setInterval(() => {
      send(FitShowProtocol.cmdPollStatus(), 'Poll');
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function setAutoPoll(enabled) {
    autoPoll = Boolean(enabled);
    if (autoPoll && isConnected) startPolling();
    else stopPolling();
  }

  async function wakeHandshake() {
    await send(FitShowProtocol.cmdDeviceInfo(), 'Wake SYS_INFO');
    setTimeout(() => send(FitShowProtocol.cmdStop(), 'Wake Reset'), 200);
    setTimeout(() => send(FitShowProtocol.cmdPollStatus(), 'Poll'), 400);
  }

  return {
    connect,
    disconnect,
    send,
    setAutoPoll,
    wakeHandshake,
    start: () => send(FitShowProtocol.cmdStart(), 'START'),
    stop:  () => send(FitShowProtocol.cmdStop(), 'STOP'),
    setSpeed: kmh => send(FitShowProtocol.cmdSetSpeed(kmh), `Speed ${Number(kmh).toFixed(1)} km/h`),
    pollOnce: () => send(FitShowProtocol.cmdPollStatus(), 'Poll'),
    onFrame: fn => frameListeners.push(fn),
    onStateChange: fn => stateListeners.push(fn),
    onLog: fn => logListeners.push(fn),
    isConnected: () => isConnected
  };
})();
