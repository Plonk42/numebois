/** The save in IndexedDB, as the JSON text that export and import also use. */
const DB = 'numebois';
const STORE = 'kv';
export const SAVE_KEY = 'numebois:save';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponible'));
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        transaction.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error('écriture impossible'));
        };
      }),
  );
}

export function readSave(): Promise<string | undefined> {
  return run<unknown>('readonly', (store) => store.get(SAVE_KEY)).then((value) =>
    typeof value === 'string' ? value : undefined,
  );
}

let writing: Promise<unknown> = Promise.resolve();

/** Writes one after the other, so the last save always wins. */
export function writeSave(json: string): Promise<void> {
  const write = writing
    .catch(() => undefined)
    .then(() => run('readwrite', (store) => store.put(json, SAVE_KEY)))
    .then(() => undefined);
  writing = write;
  return write;
}

/** Asks the browser not to evict the save when space runs low. */
export function persistStorage(): void {
  void navigator.storage?.persist?.().catch(() => false);
}
