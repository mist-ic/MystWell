# MystWell Backend: Initial Plan

## Project Goal

To build a scalable microservices-based backend for the MystWell mobile health management application.

## Core Features

1.  **User Management & Authentication:** See detailed section below.
2.  **Family Management:** Allowing primary users (Guardians) to create and manage profiles for family members (e.g., children, elderly) who don't have their own login credentials. Includes switching between profiles to manage data.
3.  **Medicine Management:** CRUD, reminders, adherence tracking, calendar data, alternative medicine info (scoped per profile).
4.  **Voice Recording:** Upload, storage, transcription (Google Speech-to-Text v2), AI summary (Gemini), metadata management (scoped per profile).
5.  **Document Management:** Upload, storage, OCR (Google Vision/Azure AI Vision), AI analysis (Gemini), metadata management (scoped per profile).
6.  **AI Chatbot:** Personalized chat using RAG, accessing data for the currently selected profile. Powered by Gemini.
7.  **Health Metrics:** Integration with external providers (e.g., Google Fit) via OAuth, data fetching and storage (scoped per profile).
8.  **Doctor Interaction:** Primarily focused on recording patient-doctor conversations, providing summaries, and extracting relevant data for the selected profile's use and chatbot context.
9.  **Notifications:** Push notifications for medicine reminders etc. (sent to Guardian's device, relevant to specific profile).

## (Updated) User Management, Authentication & Profiles

*   **Profiles:** A central concept representing individuals within the app. Each profile has a unique `profile_id`.
*   **Profile Types:**
    *   `GUARDIAN`: Can log in directly via associated credentials (email/pass, phone OTP, social). Can manage linked profiles.
    *   `MANAGED_MEMBER`: Cannot log in directly. Must be linked to at least one Guardian profile.
*   **Authentication:** Handled for Guardian profiles via Supabase Auth (Email/Pass, Phone OTP, Social Logins).
*   **Family Links:** A defined relationship (e.g., in a `family_links` table) connecting Guardian `profile_id`s to the Managed Member `profile_id`s they oversee.
*   **Active Profile Context:** Authenticated Guardians operate within the context of a single selected profile at a time (their own or one they manage). This context must be passed with API requests (e.g., via header).
*   **Authorization:** Strict Row Level Security (RLS) policies in Supabase Postgres are critical. Policies must ensure users can only access/modify data associated with their own profile or profiles they are explicitly linked to manage.

## (New) Data Scoping

*   All user-specific data tables (medicines, recordings, documents, health_metrics, chat_history, reminders, etc.) MUST contain a `profile_id` column referencing the `profiles` table.
*   Data MUST NOT be linked directly to the authentication identity (e.g., Supabase `auth.users` table) but rather to the application's `profiles` table.
*   All database queries and API logic within microservices must filter by the `profile_id` provided in the active context.

## Target Region

*   India (initially)

## Chosen Tech Stack

*   **Language/Framework:** Node.js + TypeScript + NestJS
*   **Runtime/Package Manager:** npm
*   **Core Platform:** Supabase
    *   **Authentication:** Supabase Auth (for Guardians)
    *   **Database:** Supabase Postgres (stores `profiles`, `family_links`, all profile-scoped data)
    *   **File Storage:** Supabase Storage (permissions managed via RLS considering `profile_id`)
    *   **Vector Storage:** `pgvector` extension within Supabase Postgres (embeddings must include `profile_id`)
*   **Async Task Queue:** BullMQ + Redis (Managed or Self-Hosted)
*   **External AI Services:**
    *   **Transcription:** Google Cloud Speech-to-Text v2 API
    *   **OCR:** Google Cloud Vision AI OCR / Azure AI Vision Read API
    *   **Chatbot & Summarization:** Google Gemini API (Flash model initially)
*   **Deployment:** Docker Containers + Cloud Platform (e.g., Google Cloud Run, AWS Fargate, Fly.io)

## Architecture

*   **Microservices:**
    1.  `Auth Service`: Manages `profiles`, `family_links`, Guardian authentication.
    2.  `Medicine Service`: Profile-scoped medicine data & reminders.
    3.  `Recording Service`: Profile-scoped recording upload, processing, metadata.
    4.  `Document Service`: Profile-scoped document upload, processing, metadata.
    5.  `Chatbot Service`: Profile-scoped RAG and chat history.
    6.  `Health Metrics Service`: Profile-scoped metric syncing.
    7.  `Notification Service`: Sends notifications to Guardians regarding specific profile events.
    8.  (Potentially) Dedicated Async Worker Service(s).
    9.  (Potentially) `API Gateway`: May assist in managing/passing active profile context.
*   **Asynchronous Processing:** Using BullMQ/Redis for transcription, OCR, AI analysis (jobs must include `profile_id`).

## Implementation Phases (Adjusted)

1.  **Phase 1: Foundation & Core User Features:** Setup Supabase, NestJS monorepo, implement `profiles` and `family_links` schema, implement Guardian Auth (email/pass initially), implement basic profile management (create managed profile), setup Docker & initial deployment.
2.  **Phase 2: Core Data Services (Profile-Scoped):** Implement basic profile-scoped CRUD/upload logic for Medicine, Recording, Document services. Ensure RLS enforces profile boundaries.
3.  **Phase 3: Async Processing & AI Integration:** Setup task queue, implement transcription, OCR, summarization workers (passing `profile_id`), integrate external AI APIs, store results linked to `profile_id`.
4.  **Phase 4: Chatbot & Health Metrics:** Implement Chatbot service (profile-scoped RAG with `pgvector`), integrate Gemini, implement Health Metrics service (profile-scoped OAuth/data sync).
5.  **Phase 5: Advanced Auth & Notifications:** Implement Social Login, Phone OTP Login. Implement reminder logic, Notification service (profile-aware).
6.  **Phase 6: Refinement & Scaling:** Add more providers, refine AI, optimize DB/RLS, caching, monitoring, testing.

## Key Decisions & Rationale

*   **Node.js/NestJS:** Chosen for I/O performance, TypeScript consistency, structured framework.
*   **Supabase:** Chosen for its integrated suite, especially Auth & DB/RLS for handling profile-based permissions.
*   **Microservices:** Chosen for scalability and modularity.
*   **`pgvector`:** Chosen for initial simplicity, RLS compatibility.
*   **Async Queue:** Essential for long-running AI tasks.
*   **Profile-Centric Design:** Adopted to support the core Family Feature, ensuring data segregation and correct access control. 