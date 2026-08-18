import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDVXWSOTXPyB4_ZVSEho-n6RePWgGKQySw',
  authDomain:
    'botbusters-pit-scouting-test.firebaseapp.com',
  projectId:
    'botbusters-pit-scouting-test',
  storageBucket:
    'botbusters-pit-scouting-test.firebasestorage.app',
  messagingSenderId:
    '521213603914',
  appId:
    '1:521213603914:web:0a0059f1520a97764776b3',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)