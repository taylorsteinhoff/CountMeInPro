\# CountMeIn Pro - Development Context



\## Project Overview

CountMeIn Pro is a production-ready, cross-platform mobile SaaS application that replicates and improves upon SignUpGenius.com functionality.



Core problem: Organizers (PTA, churches, nonprofits, sports teams, corporate HR) need a mobile-first, easy signup management tool. No more email chains or Google Sheets chaos.



\## Technology Stack (To Be Finalized)

\- \*\*Frontend\*\*: React Native with Expo (for cross-platform iOS/Android)

\- \*\*Backend\*\*: Node.js/Express with TypeScript

\- \*\*Database\*\*: PostgreSQL (relational data, strong transactional support)

\- \*\*Authentication\*\*: Firebase Auth or custom JWT

\- \*\*Messaging\*\*: Twilio for SMS, Firebase Cloud Messaging for push notifications

\- \*\*Hosting\*\*: AWS, Heroku, or Firebase (TBD based on scale)

\- \*\*File Storage\*\*: AWS S3 or Firebase Storage for exports



\## Supabase Configuration (Milestone 2)

\- \*\*Project URL\*\*: https://xmthyxrvserdjapxohye.supabase.co

\- \*\*Anon Public Key\*\*: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGh5eHJ2c2VyZGphcHhvaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTMxMDAsImV4cCI6MjA4NjkyOTEwMH0.n5YeorC1hCMuUFqscWgt5LdFISmU-7FHg9CPIxw5Lq0

These are the public (non-secret) credentials used to connect the React Native app to the Supabase backend.



\## Core Features (MVP - Minimum Viable Product)

1\. Organizer can create signup event in <2 minutes

2\. Generate shareable link or SMS share

3\. Participants sign up with name/email/phone (no account required)

4\. Organizer sees real-time signup list

5\. Automatic email and SMS reminders (both directions)

6\. Cancel or edit signup

7\. Prevent overbooking (capacity limits)

8\. Export participation reports (CSV)

9\. Recurring event templates

10\. Basic dashboard with event analytics



\## Monetization (Post-MVP)

\- Freemium model

\- Free: 3 active events, basic reminders

\- Pro ($9-15/month): Unlimited, SMS reminders, advanced analytics, custom branding

\- Enterprise: Multi-admin, white labeling, API



\## Target Users

\- Age 28-65, not highly technical

\- PTA/school admins, church staff, nonprofit coordinators, youth sports organizers, corporate HR, parents

\- Mobile-first, value simplicity and reliability over flashy design



\## Development Approach

1\. Start with React Native + Expo (fastest path to iOS/Android simultaneously)

2\. Build backend API as separate Node.js service

3\. Connect frontend to API incrementally

4\. Deploy backend to cloud platform (simple first, scale later)

5\. Test on both iOS and Android simulators during development

6\. Build 3 milestones:

&nbsp;  - Milestone 1: UI wireframes + dummy data (no backend)

&nbsp;  - Milestone 2: Backend API + database + auth

&nbsp;  - Milestone 3: Testing, refinement, app store preparation



\## Development Guidelines

\- Keep code modular and clean (important for long-term maintainability)

\- Use TypeScript for type safety

\- Test frequently on both iOS and Android

\- Prioritize mobile UX (not desktop-first thinking)

\- No complex animations or visual effects (this is a tool app, not a game)

\- Accessibility: reasonable color contrast, readable fonts

\- Provide clear explanations when introducing new technologies (developer has limited coding experience but strong app vision)



\## Milestones \& Timeline

\- \*\*Milestone 1\*\* (Week 1-2): Setup, architecture, UI prototype with dummy data

\- \*\*Milestone 2\*\* (Week 3-5): Backend API, database, authentication, payment integration

\- \*\*Milestone 3\*\* (Week 6-7): Testing, bug fixes, app store preparation

\- \*\*Timeline to App Store\*\*: 7-8 weeks total



\## Important Deadlines

\- iOS: Must target iOS 26 SDK by April 28, 2026

\- Android: Must target API level 35 for new apps (as of August 31, 2025)



\## Next Steps

1\. Finalize tech stack with Claude

2\. Create detailed API spec

3\. Begin Milestone 1 (UI/UX prototype)

