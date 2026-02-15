# HaramPay - Bad Word Challenge Tracker

## Quick Start

1. **Run with Live Server**
   - Open `index.html` with VS Code Live Server
   - DO NOT open directly with `file://` (Firebase modules won't work)

2. **Debugging Login Issues**
   - Open browser console (F12)
   - Click Continue button
   - Check console for these messages:
     - "Login button clicked" - button works
     - "Selected user: [name]" - selection works
     - "Starting authentication..." - Firebase call started
     - "Auth successful" - Firebase auth worked
     - "Login success" - Complete

3. **Common Issues**
   - **"Firebase is not configured yet"**: Check console for Firebase init error
   - **"Incorrect admin password"**: For Baraa, use `boba3213`
   - **Nothing happens**: Check console for errors, ensure Live Server is running
   - **Module errors**: Must use local server, not file://

## Firebase Setup Checklist

- [ ] Realtime Database created in Firebase Console
- [ ] Anonymous Authentication enabled
- [ ] Database rules set to allow authenticated users
- [ ] `databaseURL` in config matches your Firebase project

## Database Rules (Temporary for Testing)

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## Features

- User login (Baraa requires admin password: `boba3213`)
- Report bad words (pending admin approval)
- Admin panel (Baraa only)
- Manual transactions
- Personal debt tracking

## Tech Stack

- Pure HTML, CSS, JavaScript
- Firebase Realtime Database
- Firebase Anonymous Authentication
