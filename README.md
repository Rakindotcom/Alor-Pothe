# আলোর পথে (Alor Pothe) — Family Zikr Tracker

**“আল্লাহর স্মরণে আমরা সবাই একসাথে”**

**আলোর পথে** is a private, mobile-first, elderly-friendly Bangla web application built for a family of 12 members to collectively track their daily and lifetime zikr (dhikr) counts with real-time cloud synchronization.

---

## Key Features

- **Elderly-Friendly Bangla Interface (`Anek Bangla` Font)**:
  - Extra-large, high-contrast typography, generous touch targets (`60px–70px` buttons and inputs), and an instant **`অ+ লেখা বড়`** font-size booster (`100%` / `112.5%` / `125%`) in the header for family members with reduced eyesight.
  - All UI labels, confirmations, and guidance are in warm, clear Bangla, while the 12 predefined member names and comma-formatted numbers remain in crisp English (`tabular-nums`). Accepts both English (`0-9`) and Bangla (`০-৯`) digits in input fields.
- **Predefined 12 Family Members**:
  1. `Harun Or Rashid`
  2. `Moazzem Hossain`
  3. `Rashed Dewan`
  4. `Saiful Islam`
  5. `Fauzia Sultana`
  6. `Tahmina Chowdhury`
  7. `Tanzina Sarkar`
  8. `Nazma Akter`
  9. `Rakin al Shahriar`
  10. `Tasnimul Hasan`
  11. `Israt Jahan`
  12. `Sanjida Islam`
- **Real-Time Synchronization**:
  - Powered by **Cloud Firestore (`onSnapshot`)** (`asia-south1`). When any family member adds zikr on their smartphone, every other phone viewing the page sees the updated member total, collective family total, leaderboard rankings, and recent activity automatically without refreshing.
- **Atomic Transactions & Idempotent Submissions**:
  - Direct browser writes to Firestore are completely disabled (`allow write: if false` in [`firestore.rules`](./firestore.rules)).
  - All writes go through Next.js server endpoints using the **Firebase Admin SDK** and atomic `runTransaction` calls.
  - Every submission carries a client-generated `submissionId` used as the Firestore transaction key so double-taps or unstable mobile network retries never duplicate counts or overwrite simultaneous submissions.
- **Daily (`আজকের হিসাব`) & Lifetime (`সর্বমোট হিসাব`) Tracking**:
  - Daily boundaries strictly follow Bangladesh Standard Time (`Asia/Dhaka`, `UTC+06:00`) and automatically roll over at midnight Dhaka time while preserving lifetime totals permanently.
- **Tie-Breaking Rule**:
  - Members are ranked from highest to lowest zikr count for the selected period (`সর্বমোট` or `আজকের`). When two members have an equal zikr count, positions follow the predefined family member order (`1` through `12`). Top 3 contributors (`zikr > 0`) are highlighted with subtle gold, silver, and bronze accents.
- **Individual Member Statistics**:
  - Tapping any member on the leaderboard opens a clean mobile sheet showing their lifetime zikr, today's zikr (`Asia/Dhaka`), current rank, total submissions, and recent submission history.
- **Protected Admin Error Correction (`/admin`)**:
  - Server-verified Admin PIN authentication (`HttpOnly`, `SameSite=Strict`, HMAC-signed session cookie + brute-force rate limiting).
  - Administrators can review submission history, correct mistaken counts (e.g., `50,000` -> `5,000`), reverse accidental entries, run full ledger reconciliation, and inspect an immutable correction audit trail (`admin_audit_logs`).
- **Private & Installable PWA**:
  - Blocks search engine indexing (`noindex, nofollow`, `X-Robots-Tag`, `robots.txt` disallowing `/`), uses zero ad/analytics trackers, and supports **Add to Home Screen** on Android and iPhone with custom icons and honest offline detection.

---

## Database Schema (Cloud Firestore)

1. **`family_members/{memberId}`**
   - `id` (`string`, deterministic slug e.g. `"harun-or-rashid"`)
   - `name` (`string`)
   - `display_order` (`number`, `1..12`)
   - `total_zikr` (`number`, atomic cumulative lifetime total)
   - `submission_count` (`number`)
   - `created_at` (`string`, ISO 8601)
   - `updated_at` (`string`, ISO 8601)

2. **`zikr_submissions/{submissionId}`**
   - `id` / `submission_id` (`string`, idempotency key)
   - `member_id` (`string`)
   - `member_name` (`string`)
   - `zikr_count` (`number`, effective count)
   - `original_zikr_count` (`number`, initial submitted count)
   - `submitted_at` (`string`, ISO 8601)
   - `submitted_at_ms` (`number`, epoch ms)
   - `dhaka_date` (`string`, `YYYY-MM-DD` in `Asia/Dhaka`)
   - `status` (`"active" | "corrected" | "reversed"`)
   - `updated_at` (`string`)
   - `correction_note` (`string | null`)

3. **`admin_audit_logs/{auditId}`** *(Server-only access)*
   - Immutable audit trail of every admin correction or reversal (`previous_count`, `new_count`, `delta`, `previous_member_total`, `new_member_total`, `reason`, `created_at`).

---

## Local Setup & Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and ensure your Firebase Web config, Firebase Admin Service Account credentials, and `ADMIN_PIN` are set:
   ```bash
   cp .env.example .env.local
   ```
   *(Note: `.env.local` is already configured on this machine and excluded via `.gitignore`.)*

3. **Deploy Firestore Security Rules** (already deployed to `alor-pothe-fatima-manjil`):
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` on your phone or browser.
   Admin panel: `http://localhost:3000/admin`

5. **Run automated tests & production build**:
   ```bash
   npm test
   npm run build
   ```

---

## Deploying to Vercel or Netlify

1. Push this project to a **private** GitHub/GitLab repository (`.env.local` is gitignored so secrets are never committed).
2. Import the repository into **Vercel** (recommended for Next.js) or **Netlify**.
3. Add all environment variables from `.env.local` (see `.env.example`) into your Vercel/Netlify project's **Environment Variables** settings:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `ADMIN_PIN` *(set your secret family admin PIN)*
   - `ADMIN_SESSION_SECRET` *(64-character random hex string)*
   - `FAMILY_ACCESS_CODE` *(optional; leave empty for zero-PIN daily submission, or set a code and set `NEXT_PUBLIC_REQUIRE_FAMILY_CODE="true"`)*
4. Deploy! Share the private URL with the 12 family members and invite them to tap **"Add to Home Screen"** on their smartphones.
