# MystWell Backend: Progress Tracker

## Phase 1: Foundation & Core User Features

*   [ ] Set up Supabase project (DB, Auth, Storage).
    *   [ ] Identified Project/Org IDs.
    *   [ ] Retrieved API URL/Keys.
    *   [ ] Created `.env` and `.env.e ample`.
    *   [ ] Enabled `pgvector` e tension.
*   [ ] Set up NestJS monorepo structure.
    *   [ ] Initialize NestJS project using `bun`.
    *   [ ] Configure monorepo workspace.
*   [ ] Resolve Build/Path Issues.
    *   [ ] Verified file structure.
    *   [ ] Corrected relative import paths.
    *   [ ] Simplified DTO/Entity file locations.
    *   [ ] Build successful.
*   [ ] Implement Auth Service.
    *   [ ] Setup Supabase Auth integration.
        *   [ ] Installed dependencies (`@nestjs/config`, `@supabase/supabase-js`, `class-validator`, `class-transformer`, `@nestjs/mapped-types`).
        *   [ ] Configured `ConfigModule`.
        *   [ ] Created `SupabaseModule` and `SupabaseService`.
        *   [ ] Created `ProfilesModule` and `ProfilesService` (incl. file structure correction).
        *   [ ] Implemented `ProfilesService.createProfile`.
        *   [ ] Implemented `ProfilesService.findProfileByUserId`.
        *   [ ] Injected services correctly.
    *   [ ] Implement email/password signup/login endpoints.
        *   [ ] Created DTOs (`GuardianSignUpDto`, `GuardianSignInDto`).
        *   [ ] Implemented `AuthService.signUpGuardian` (using `ProfilesService`).
        *   [ ] Implemented `AuthService.signInGuardian` (using `ProfilesService`).
        *   [ ] Added `/auth/signup/guardian` endpoint.
        *   [ ] Added `/auth/signin/guardian` endpoint.
    *   [ ] Setup JWT generation/validation or session management (JWT provided by Supabase, need validation strategy).
        *   [ ] Installed JWT dependencies (`@nestjs/jwt`, `passport-jwt`, `@types/passport-jwt`).
        *   [ ] Added `SUPABASE_JWT_SECRET` to `.env`/`.env.e ample`.
        *   [ ] Configured `PassportModule` and `JwtModule.registerAsync` in `AuthModule`.
        *   [ ] Created `JwtStrategy` (validates token, fetches profile).
        *   [ ] Created `JwtAuthGuard`.
        *   [ ] Applied `JwtAuthGuard` to `ProfilesController.createManagedProfile`.
        *   [ ] Updated `createManagedProfile` to use `req.user`.
    *   [ ] Implement basic profile endpoints (Get own profile, list managed profiles).
        *   [ ] Created `CreateManagedProfileDto` and `UpdateProfileDto`.
        *   [ ] Created `FamilyLinksModule` and `FamilyLinksService`.
        *   [ ] Implemented `FamilyLinksService.createLink`, `findLinksByGuardianId`, `isGuardianOf`.
        *   [ ] Implemented `ProfilesService.createManagedProfile`, `findProfilesByIds`, `findManagedProfiles`, `findOne`, `updateProfile`.
        *   [ ] Created `ProfilesController`.
        *   [ ] Added `POST /profiles/managed` endpoint (Guarded).
        *   [ ] Added `GET /profiles/me` endpoint (Guarded).
        *   [ ] Added `GET /profiles/managed` endpoint (Guarded).
        *   [ ] Added `GET /profiles/:id` endpoint (Guarded, includes authz).
        *   [ ] Added `PUT /profiles/:id` endpoint (Guarded, includes authz).
*   [ ] Implement RLS Policies.
    *   [ ] Created `requesting_profile_id()` SQL helper function.
    *   [ ] Defined and applied SELECT/UPDATE policies for `profiles` table (self, managed).
    *   [ ] Defined and applied SELECT/INSERT/DELETE policies for `family_links` table (guardian-based).
*   [ ] Implement Family Link Deletion.
    *   [ ] Implemented `FamilyLinksService.removeLink`.
    *   [ ] Added `DELETE /profiles/managed/:managedProfileId/link` endpoint (Guarded).
*   [ ] Refine Error Handling/Transactions.
    *   [ ] Added compensation logic (delete auth user) to `signUpGuardian`.
    *   [ ] TODO: Add compensation logic (delete profile) to `createManagedProfile`.
*   [ ] Implement Testing Strategy.
    *   [ ] Unit Tests (`ProfilesService`, `FamilyLinksService` implemented).
    *   [ ] Unit Tests (`AuthService`, `JwtStrategy` pending).
    *   [ ] Integration Tests (Service interactions) - *Partially covered by Unit tests, can enhance later*.
    *   [ ] E2E Tests (Signup/Signin/Profile Me implemented, others pending).
*   [ ] Implement Social Login / Mobile OTP.
*   [ ] Implement basic Medicine Service.
    *   [ ] Define database schema (medicines table).
    *   [ ] Implement CRUD API endpoints (create, read, update, delete).
    *   [ ] Ensure endpoints are protected and user-scoped.
*   [ ] Implement basic Recording Service.
    *   [ ] Define database schema (recordings table - metadata only).
    *   [ ] Implement endpoint to generate secure upload URL (Supabase Storage).
    *   [ ] Implement endpoint to confirm upload and save metadata.
    *   [ ] Implement endpoint to list recordings for a user.
    *   [ ] Ensure endpoints are protected and user-scoped.
*   [ ] Implement basic Document Service.
    *   [ ] Define database schema (documents table - metadata only).
    *   [ ] Implement endpoint to generate secure upload URL (Supabase Storage).
    *   [ ] Implement endpoint to confirm upload and save metadata.
    *   [ ] Implement endpoint to list documents for a user.
    *   [ ] Ensure endpoints are protected and user-scoped.
*   [ ] Set up Dockerfiles for services.
*   [ ] Configure initial deployment pipeline (e.g., simple Cloud Run setup).
*   [ ] Integrate basic APIs into the frontend (listing medicines, recordings, documents; login/signup).

## Phase 2: Async Processing & AI Integration

*   [ ] Set up Redis instance.
*   [ ] Integrate BullMQ into relevant services/worker.
*   [ ] Implement Transcription Worker.a
    *   [ ] Publish `transcription_completed` event.
*   [ ] Implement OCR Worker.
    *   [ ] Consume `ocr_needed` jobs.
    *   [ ] Integrate Google/Azure OCR API client.
    *   [ ] Save OCR te t to DB.
    *   [ ] Publish `ocr_completed` event.
*   [ ] Implement Summarization Worker.
    *   [ ] Consume relevant events (e.g., `transcription_completed`).
    *   [ ] Integrate Gemini API client.
    *   [ ] Save summary/analysis to DB.
    *   [ ] Publish `summary_completed` event.
*   [ ] Update frontend to show processing status and results.

## Phase 3: Chatbot & Health Metrics

*   [ ] Set up `pgvector` e tension in Supabase.
*   [ ] Implement Chatbot Service API endpoint.
*   [ ] Implement data retrieval logic for RAG conte t.
*   [ ] Implement vector embedding generation (using Gemini or other).
*   [ ] Implement vector storage logic (`pgvector`).
*   [ ] Implement vector search logic.
*   [ ] Integrate Gemini API for chat generation.
*   [ ] Implement basic chat history storage.
*   [ ] Implement Health Metrics Service.
    *   [ ] Setup OAuth flow for Google Fit.
    *   [ ] Implement secure token storage.
    *   [ ] Implement data fetching logic.
    *   [ ] Define schema and store metrics in DB.
*   [ ] Integrate Chatbot and Health Metrics into frontend.

## Phase 4: Reminders & Notifications

*   [ ] Implement reminder scheduling logic (Medicine Service).
*   [ ] Set up scheduled task runner (e.g., node-cron within service, or cloud scheduler).
*   [ ] Implement Notification Service.
    *   [ ] Manage device tokens.
    *   [ ] Integrate with E po Push Notifications/FCM.
*   [ ] Trigger notifications for reminders.
*   [ ] Integrate reminder setup/tracking into frontend.

## Phase 5: Refinement & Scaling

*   [ ] Add more health metric providers.
*   [ ] Refine AI analysis features.
*   [ ] Implement database optimizations (inde ing).
*   [ ] Add caching (Redis).
*   [ ] Setup monitoring/logging/alerting stack.
*   [ ] Perform load testing. 