# BrasilNova Trading — Complete React/Vite Starter

This package contains a responsive web-app starter with:
- Firebase email/password registration and login
- Firestore user profile (new account starts at R$ 0)
- Deposit requests saved in `depositRequests`
- Withdrawal requests saved in `withdrawalRequests`
- Deposit/withdrawal history
- Dashboard, account activity, support and a unique animated mining-demo page
- Mobile responsive layout

## Important: money and mining
This is a starter/prototype, not a live financial service. Deposit and withdrawal requests are saved as **pending**; they do not transfer money or change the balance automatically. The mining screen is an explicitly labelled local simulation and does not mine real cryptocurrency, produce real profit, or credit withdrawable funds. Do not advertise simulated balances as real earnings. For live deposits/withdrawals, integrate a licensed payment provider and a trusted server-side approval system. Do not let a browser client approve its own transactions.

## Run on Android/Linux or a computer
1. Extract this ZIP.
2. Open the extracted `brasilnova-trading-complete` folder in your editor/terminal.
3. Copy `.env.example` to `.env`.
4. Fill in your Firebase **web app** configuration values from Firebase Console → Project settings → Your apps. Never place a service-account private key in this frontend.
5. In Firebase Console, enable Authentication → Email/Password and create a Firestore database.
6. Publish secure Firestore rules (see below).
7. Run:
   ```sh
   npm install
   npm run dev -- --host 127.0.0.1
   ```
   Open the local URL shown by Vite. If you need access from another device on the same network, use `npm run dev -- --host 0.0.0.0`.
8. Test a new account and check Firebase Console → Firestore → Data.

## Firestore rules starter
Review and publish rules in Firebase Console → Firestore Database → Rules. These rules let each signed-in user create/read their own requests, but intentionally prevent client-side status approvals and balance edits. Adjust only after you design a trusted admin/backend flow.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }

    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow create: if signedIn()
        && request.auth.uid == uid
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.balance == 0
        && request.resource.data.currency == 'BRL'
        && request.resource.data.status == 'active';
      allow update, delete: if false;
    }

    match /depositRequests/{id} {
      allow create: if signedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.userEmail == request.auth.token.email
        && request.resource.data.amount is number
        && request.resource.data.amount > 0
        && request.resource.data.amount <= 1000000
        && request.resource.data.status == 'pending'
        && request.resource.data.reference is string
        && request.resource.data.createdAt == request.time
        && request.resource.data.keys().hasOnly(['userId','userEmail','amount','status','reference','createdAt']);
      allow read: if signedIn() && resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }

    match /withdrawalRequests/{id} {
      allow create: if signedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.userEmail == request.auth.token.email
        && request.resource.data.amount is number
        && request.resource.data.amount > 0
        && request.resource.data.amount <= 1000000
        && request.resource.data.status == 'pending'
        && request.resource.data.reference is string
        && request.resource.data.payoutDetails is string
        && request.resource.data.createdAt == request.time
        && request.resource.data.keys().hasOnly(['userId','userEmail','amount','status','reference','payoutDetails','createdAt']);
      allow read: if signedIn() && resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Notes
- `VITE_SUPPORT_EMAIL` can be changed in `.env`.
- `mailto:` opens the device's configured mail app; it does not read replies or automatically process email.
- The app requires internet access for Firebase and the optional Google Fonts stylesheet.
- Before production: configure App Check, password reset, email verification, rate limiting, audit logging, admin roles on a trusted server, payment-provider webhooks, and privacy/terms pages. Have the financial and legal model reviewed before accepting real funds.
