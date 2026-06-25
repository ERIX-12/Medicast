export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MediCastDB', 1);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('analysis_cache')) {
        db.createObjectStore('analysis_cache');
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveSessionToIndexedDB = async (frames: any[], videoFile: File | Blob | null) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('analysis_cache', 'readwrite');
      const store = transaction.objectStore('analysis_cache');
      store.put(frames, 'current_frames');
      if (videoFile) {
        store.put(videoFile, 'current_video');
      }
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error saving session to IndexedDB:', error);
  }
};

export const loadSessionFromIndexedDB = async (): Promise<{ frames: any[] | null, videoFile: File | Blob | null }> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('analysis_cache', 'readonly');
      const store = transaction.objectStore('analysis_cache');
      const framesReq = store.get('current_frames');
      const videoReq = store.get('current_video');
      
      let frames: any = null;
      let videoFile: any = null;
      
      framesReq.onsuccess = () => { frames = framesReq.result; };
      videoReq.onsuccess = () => { videoFile = videoReq.result; };
      
      transaction.oncomplete = () => resolve({ frames: frames || null, videoFile: videoFile || null });
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error loading session from IndexedDB:', error);
    return { frames: null, videoFile: null };
  }
};

export const clearSessionFromIndexedDB = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('analysis_cache', 'readwrite');
      const store = transaction.objectStore('analysis_cache');
      store.delete('current_frames');
      store.delete('current_video');
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error clearing session from IndexedDB:', error);
  }
};
