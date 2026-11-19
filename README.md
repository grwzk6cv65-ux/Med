# MEDRADAR — Rural Healthcare Radar & Closed-Loop Care Prototype

MEDRADAR is a 100% free, client-side interactive healthcare platform prototype designed for rural & regional medical coordination across **80 fictional demonstration villages** and **20 medical clusters**.

> **Zero Paid Services:** This prototype runs entirely in the browser using free open-source libraries, local JSON demonstration data, `localStorage` persistence, OpenStreetMap tiles via Leaflet, and transparent rule-based JavaScript triage simulation. Never store real patient data in this demo.

---

## 100% Free Technology Stack

- **React 19 + Vite + TypeScript** — Fast frontend build & static bundle
- **Tailwind CSS v4** — Utility-first styling
- **Lucide React** — Open-source UI icons
- **Recharts** — Interactive analytics charts
- **Leaflet + OpenStreetMap** — Free interactive mapping (no paid map keys)
- **Browser `localStorage` + Local JSON** — Persistent demo referrals, Rapid Lab logs, MedMobile stops, and preventive reminders
- **Rule-Based JavaScript Engine (`src/utils/aiRadarEngine.ts`)** — Deterministic AI Health Radar triage simulation (no external paid AI APIs)
- **Local Translation Dictionaries (`src/i18n/translations.ts`)** — Complete Kazakh (`kk`), Russian (`ru`), and English (`en`) switching

---

## Included MEDRADAR Modules

1. **Doctor & Patient Dashboards (`DashboardView`)**
   - Switch between **Doctor View** (priority AI Health Radar triage queue, active MedMobile fleet, Closed-Loop Care alerts) and **Patient View** (personal Health Passport summary, village MedMobile visit, preventive checklist, care journey).
2. **Interactive Regional Map (`RegionalMapView`)**
   - Displays **80 fictional villages** and **20 medical cluster hubs** on OpenStreetMap.
   - Filter by risk tier, cluster, or village name; toggle cluster links; inspect village readiness; run Rapid Lab or dispatch an extra MedMobile stop.
3. **RAPID LAB (`RapidLabView`)**
   - Point-of-care capillary & biometric diagnostics simulator (BP, SpO2, Glucose, HbA1c, Hemoglobin, CRP, Cholesterol).
   - Flags abnormal biomarkers and updates patient records in `localStorage`.
4. **AI HEALTH RADAR (`AiHealthRadarView`)**
   - Transparent rule-based risk assessment simulation (`0–100` score).
   - Adjust sliders and clinical symptoms live to inspect exact rule weights, recommended specialty, and care pathway.
5. **MEDMOBILE Weekly Schedule (`MedMobileView`)**
   - Coordinate 20 mobile clinic units across Monday–Sunday routes, book patient slots, cycle visit statuses, and add stops.
6. **HEALTH PASSPORT & SMART REFERRALS (`PassportReferralsView`)**
   - Digital patient passport profiles (blood type, chronic conditions, allergies, vaccinations, vitals, offline ID) paired with cluster-matched hospital referral booking.
7. **PREVENTIVE CARE, PATIENT JOURNEY & CLOSED-LOOP CARE (`CareLoopJourneyView`)**
   - 6-stage longitudinal patient journey tracker, preventive care reminder manager, and Closed-Loop Care verification monitor.
8. **Interactive Analytics (`AnalyticsView`)**
   - Recharts visualizations covering village risk distribution, cluster screening coverage, dominant clinical concerns, and the Closed-Loop Care funnel.

---

## Local Setup

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

To build the static production bundle:

```bash
npm run build
```

The production static files are output to `dist/`.

---

## Free Static Deployment

Because `vite.config.ts` uses `base: './'` and all data/simulation runs locally in the browser, `dist/` can be hosted for **$0** on any static host:

### Option A: Cloudflare Pages (Free)
1. Push this repository to GitHub or GitLab.
2. Open **Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git**.
3. Set **Build command** to `npm run build` and **Build output directory** to `dist`.
4. Deploy with zero environment variables required.

### Option B: GitHub Pages (Free)
1. Run `npm run build` locally (or via a GitHub Actions workflow using `actions/upload-pages-artifact` on `./dist`).
2. Publish the contents of `dist/` to the `gh-pages` branch or configure **Settings -> Pages -> GitHub Actions**.
3. Relative paths (`base: './'`) ensure assets load cleanly under `https://<username>.github.io/<repo>/`.
