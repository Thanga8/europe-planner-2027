/**
 * Robust Native IndexedDB Storage for Trip Documents & PDF Vouchers
 * Bypasses the 5MB browser localStorage limit and prevents QuotaExceededError.
 */

const DB_NAME = 'europe27_vault_db';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

interface StoredDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataBase64: string;
  uploadedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a document attachment to IndexedDB
 */
export async function saveDocumentToVault(doc: StoredDocument): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(doc);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save document to IndexedDB:', err);
    return false;
  }
}

/**
 * Retrieve a document attachment from IndexedDB by ID
 */
export async function getDocumentFromVault(id: string): Promise<StoredDocument | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get document from IndexedDB:', err);
    return null;
  }
}

/**
 * Get all documents stored in IndexedDB
 */
export async function getAllDocumentsFromVault(): Promise<StoredDocument[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to list documents from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a document from IndexedDB by ID
 */
export async function deleteDocumentFromVault(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete document from IndexedDB:', err);
    return false;
  }
}

/**
 * Request persistent storage from the browser / Android OS
 * Prevents OS from evicting app data under disk pressure
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log('Browser storage persistence status:', isPersisted);
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

