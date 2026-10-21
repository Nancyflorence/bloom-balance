# Bloom Balance (Vue 3 + Firebase + Chart.js + AI)

## Setup
1. Firebase console: create project > Authentication > enable Email/Password > Firestore Database (production mode).
2. Firestore Rules (so each user sees only their data):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
3. Frontend: `cp .env.example .env`, fill Firebase values, then `npm install && npm run dev`
4. Backend (new terminal): `cd server && cp .env.example .env`, add GEMINI_API_KEY, then `npm install && npm start`

## Architecture (say this in the interview)
Vue 3 SPA -> Vue Router guards private pages using Firebase Auth state -> Firestore stores per-user transactions with realtime listeners -> Chart.js renders computed totals -> an Express proxy calls the Gemini API so the key never reaches the browser.
