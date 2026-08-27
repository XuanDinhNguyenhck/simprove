/* Once-a-day backup of the whole log to a file in a private GitHub repo.
   One way by design: this device is the source of truth, GitHub is the copy you
   fall back on when the phone wipes its storage. Restore is explicit and asks first.

   The token lives in its own localStorage key, so it is never part of an
   export/import of the log itself. */

const Backup = (() => {
  const KEY  = 'gym-workout-log/backup-v1';
  const API  = 'https://api.github.com';
  const DUE  = 20 * 60 * 60 * 1000;     /* "daily", with slack so it never skips a day */
  const RETRY = 30 * 60 * 1000;         /* after a failure, do not hammer it */

  const defaults = { token: '', repo: '', path: 'log.json',
                     lastOk: 0, lastTry: 0, lastError: '', lastBytes: 0 };

  let cfg = read();
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn(status()));

  function read() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return Object.assign({}, defaults); }
  }
  function write() { localStorage.setItem(KEY, JSON.stringify(cfg)); notify(); }

  const configured = () => Boolean(cfg.token && /^[\w.-]+\/[\w.-]+$/.test(cfg.repo));
  const due = () => configured() && Store.loggedKeys().length > 0 &&
                    Date.now() - cfg.lastOk > DUE &&
                    Date.now() - cfg.lastTry > RETRY;

  /* ---- base64 that survives non-ASCII notes, chunked so a year of logs
          does not blow the argument limit on String.fromCharCode ---- */
  function toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromB64(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function explain(res) {
    if (res.status === 401) return 'Token rejected — it has expired or been revoked.';
    if (res.status === 403) return 'Token lacks “Contents: read and write” on that repository.';
    if (res.status === 404) return 'Repository or file path not found — check the name, and that the token is scoped to this repo.';
    if (res.status === 409 || res.status === 422) return 'GitHub copy changed since the last backup — press “Back up now” to overwrite it.';
    return `GitHub returned ${res.status}.`;
  }

  function call(method, body) {
    return fetch(`${API}/repos/${cfg.repo}/contents/${encodeURI(cfg.path)}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: body ? JSON.stringify(body) : undefined
    });
  }

  /* the sha of what is up there now — GitHub needs it to replace a file */
  async function currentSha() {
    const res = await call('GET');
    if (res.status === 404) return null;                 /* first ever backup */
    if (!res.ok) throw new Error(explain(res));
    return (await res.json()).sha;
  }

  let running = false;
  async function run() {
    if (running || !configured()) return false;
    running = true;
    cfg.lastTry = Date.now(); write();
    try {
      if (!navigator.onLine) throw new Error('No connection — it will try again later.');
      const json = JSON.stringify(Store.state);
      const sha = await currentSha();
      const days = Store.loggedKeys().length;
      const res = await call('PUT', {
        message: `Backup ${Store.key(new Date())} · ${days} day${days === 1 ? '' : 's'}`,
        content: toB64(json),
        ...(sha ? { sha } : {})
      });
      if (!res.ok) throw new Error(explain(res));
      cfg.lastOk = Date.now(); cfg.lastError = ''; cfg.lastBytes = json.length;
      write();
      return true;
    } catch (e) {
      cfg.lastError = e.message || String(e); write();
      return false;
    } finally { running = false; }
  }

  /* Pull the backup down over whatever is on this device. Caller confirms first. */
  async function restore() {
    const res = await call('GET');
    if (res.status === 404) throw new Error('No backup file in that repository yet.');
    if (!res.ok) throw new Error(explain(res));
    const body = await res.json();
    const data = JSON.parse(fromB64(body.content));
    Store.replaceAll(data);
    return Store.loggedKeys().length;
  }

  function status() {
    return {
      configured: configured(), due: due(), repo: cfg.repo, path: cfg.path,
      hasToken: Boolean(cfg.token), lastOk: cfg.lastOk, lastError: cfg.lastError,
      lastBytes: cfg.lastBytes
    };
  }

  /* Check when the app opens, and again while it stays open, so leaving the tab
     up all day still produces a backup. */
  let timer;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (due()) run().then(schedule); else schedule(); }, 10 * 60 * 1000);
  }
  function start() {
    if (due()) run();
    schedule();
    window.addEventListener('online', () => { if (due()) run(); });
  }

  return {
    status, start, restore,
    backupNow: run,
    onChange: fn => listeners.push(fn),
    save(patch) { Object.assign(cfg, patch); cfg.lastError = ''; write(); },
    forget() { cfg = Object.assign({}, defaults); write(); }
  };
})();
