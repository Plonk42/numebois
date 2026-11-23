/** The save in IndexedDB, as the JSON text that export and import also use; the Album beside it. */
const DB = 'numebois';
const STORE = 'kv';
export const SAVE_KEY = 'numebois:save';
/** Apart from the save, written at every answer: the Album only changes with a new painting. */
export const ALBUM_KEY = 'numebois:album';

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
  return read(SAVE_KEY);
}

export function readAlbum(): Promise<string | undefined> {
  return read(ALBUM_KEY);
}

function read(key: string): Promise<string | undefined> {
  return run<unknown>('readonly', (store) => store.get(key)).then((value) =>
    typeof value === 'string' ? value : undefined,
  );
}

let writing: Promise<unknown> = Promise.resolve();

/** Writes one after the other, so the last save always wins. */
export function writeSave(json: string): Promise<void> {
  return write(SAVE_KEY, json);
}

export function writeAlbum(json: string): Promise<void> {
  return write(ALBUM_KEY, json);
}

function write(key: string, json: string): Promise<void> {
  const next = writing
    .catch(() => undefined)
    .then(() => run('readwrite', (store) => store.put(json, key)))
    .then(() => undefined);
  writing = next;
  return next;
}

/** Asks the browser not to evict the save when space runs low. */
export function persistStorage(): void {
  void navigator.storage?.persist?.().catch(() => false);
}
