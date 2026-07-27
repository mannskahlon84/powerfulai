import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Save user's complete chat history across sessions to Firebase Firestore + LocalStorage.
 * Keeps full context of user prompts, AI text responses, and generated image markdown/URLs.
 */
export async function saveChatHistoryToDb(userId, chatHistory) {
  // Always update localStorage first for instant synchronous offline availability
  try {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  } catch (e) {
    console.warn("LocalStorage save warning:", e);
  }

  if (!db || !userId) return;

  try {
    const userDocRef = doc(db, 'users', String(userId));
    await setDoc(
      userDocRef,
      {
        chatHistory: chatHistory,
        lastUpdated: Date.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("Firestore chat storage fallback (saved locally):", error.message);
  }
}

/**
 * Load user's persistent chat history from Firebase Firestore database.
 * If user returns days or months later, clicking an old chat session reloads full context.
 */
export async function loadChatHistoryFromDb(userId) {
  let localData = null;
  try {
    const saved = localStorage.getItem('chatHistory');
    if (saved) localData = JSON.parse(saved);
  } catch (e) {
    console.warn("LocalStorage read warning:", e);
  }

  if (!db || !userId) {
    return localData || [{ id: Date.now(), title: 'New Chat', messages: [] }];
  }

  try {
    const userDocRef = doc(db, 'users', String(userId));
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && Array.isArray(docSnap.data().chatHistory) && docSnap.data().chatHistory.length > 0) {
      const remoteHistory = docSnap.data().chatHistory;
      // Sync remote down to local cache
      try {
        localStorage.setItem('chatHistory', JSON.stringify(remoteHistory));
      } catch (e) {}
      return remoteHistory;
    }
  } catch (error) {
    console.warn("Firestore read fallback to localStorage:", error.message);
  }

  return localData || [{ id: Date.now(), title: 'New Chat', messages: [] }];
}
