import type { FirebaseOptions } from 'firebase/app';
import type { CloudGateway, CloudRecord } from './CloudSaveSync.ts';

export interface AccountIdentity {
  uid: string;
  name: string;
}

export interface AccountGateway extends CloudGateway {
  redirectError?: unknown;
  observe(callback: (account: AccountIdentity | null) => void): void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const cloudConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain &&
  firebaseConfig.projectId && firebaseConfig.appId);

export async function connectAccountGateway(): Promise<AccountGateway> {
  const [appSdk, authSdk, firestore] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite')
  ]);
  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = firestore.getFirestore(app);
  const emulator = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
  if (emulator) {
    authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  const provider = new authSdk.GoogleAuthProvider();
  const doc = (uid: string) => firestore.doc(db, 'saves', uid);
  const readRecord = (snapshot: import('firebase/firestore/lite').DocumentSnapshot): CloudRecord | null => {
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (typeof data.payloadJson !== 'string' || !Number.isSafeInteger(data.revision) ||
        data.revision < 1 || typeof data.writeId !== 'string') {
      throw new Error('O save na nuvem está em um formato inválido.');
    }
    return { payloadJson: data.payloadJson, revision: data.revision, writeId: data.writeId,
      updatedAt: data.updatedAt?.toMillis?.() ?? 0 };
  };

  let redirectError: unknown;
  try { await authSdk.getRedirectResult(auth); } catch (error) { redirectError = error; }
  return {
    redirectError,
    observe(callback) {
      authSdk.onAuthStateChanged(auth, user => callback(user ? {
        uid: user.uid, name: user.displayName || user.email || 'Conta Google'
      } : null));
    },
    async signIn() {
      if (matchMedia('(pointer: coarse)').matches && !emulator && !import.meta.env.DEV) {
        await authSdk.signInWithRedirect(auth, provider);
        return;
      }
      try {
        await authSdk.signInWithPopup(auth, provider);
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/popup-blocked' || import.meta.env.DEV) throw error;
        await authSdk.signInWithRedirect(auth, provider);
      }
    },
    async signOut() { await authSdk.signOut(auth); },
    async read(uid) { return readRecord(await firestore.getDoc(doc(uid))); },
    async write(uid, revision, payloadJson, writeId) {
      const ref = doc(uid);
      return firestore.runTransaction(db, async transaction => {
        const current = readRecord(await transaction.get(ref));
        if (current?.writeId === writeId) return { saved: current };
        if ((current?.revision ?? 0) !== revision) return { conflict: current };
        const next = { payloadJson, revision: revision + 1, writeId };
        transaction.set(ref, { ...next, updatedAt: firestore.serverTimestamp() });
        return { saved: { ...next, updatedAt: Date.now() } };
      });
    }
  };
}
