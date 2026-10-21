// Preserve unreadable saves before replacing them, and never overwrite an unread store.
export function recoverableStorage(key, storage = () => globalThis.localStorage, makeId = () => crypto.randomUUID()) {
  let readComplete = false, unreadable = null;
  return {
    read(decode, legacyKey) {
      const target = storage();
      if (!target) throw new Error('storage unavailable');
      const raw = target.getItem(key);
      readComplete = true;
      if (raw !== null) {
        try { return decode(raw); }
        catch (error) { unreadable = raw; throw error; }
      }
      // Legacy bytes stay at their original key even when migration fails.
      const legacy = legacyKey ? target.getItem(legacyKey) : null;
      return legacy === null ? null : decode(legacy, true);
    },
    write(value) {
      const target = storage();
      if (!target || !readComplete) throw new Error('storage not read');
      const json = JSON.stringify(value);
      if (unreadable !== null) {
        const recoveryKey = `${key}-recovery-${makeId()}`;
        if (target.getItem(recoveryKey) !== null) throw new Error('recovery collision');
        target.setItem(recoveryKey, unreadable);
        unreadable = null;
      }
      target.setItem(key, json);
    },
  };
}
