import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from './firebase.config'

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
auth.useDeviceLanguage()

const provider = new GoogleAuthProvider()

export function signIn() {
  return signInWithPopup(auth, provider)
}

export function signOutNow() {
  return signOut(auth)
}

export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}
