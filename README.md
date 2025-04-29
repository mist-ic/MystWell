# MystWell Backend Server

This directory contains the NestJS backend server for the MystWell application. It handles authentication, profile management, recording processing (including transcription and analysis), and interactions with external services like Supabase and Google Cloud.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
  - [Cloning the Repository](#cloning-the-repository)
  - [Environment Variables (.env)](#environment-variables-env)
  - [Google Cloud Credentials](#google-cloud-credentials)
- [Installation](#installation)
- [Running the Application](#running-the-application)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
- [External Services Setup](#external-services-setup)
  - [Supabase Setup](#supabase-setup)
  - [Google Cloud Platform Setup](#google-cloud-platform-setup)
  - [Redis Setup (for BullMQ)](#redis-setup-for-bullmq)
- [Database Migrations (Supabase)](#database-migrations-supabase)
- [Testing](#testing)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)

## Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js:** (Version recommended by NestJS, e.g., v18 or later)
- **npm** (or Yarn)
- **Docker:** Required for running Redis locally.
- **Supabase CLI:** ([Installation Guide](https://supabase.com/docs/guides/cli/getting-started))
- **Git**

You will also need accounts for:

- **Supabase:** ([supabase.com](https://supabase.com))
- **Google Cloud Platform (GCP):** ([cloud.google.com](https://cloud.google.com)) with billing enabled.

## Environment Setup

### Cloning the Repository

```bash
git clone <repository-url>
cd MystWell/Backend/server
```

### Environment Variables (.env)

Create a `.env` file in the `Backend/server` directory. This file stores sensitive credentials and configuration. **Do not commit this file to Git.**

```dotenv
# Supabase Credentials
SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL=YOUR_SUPABASE_POSTGRES_CONNECTION_STRING # e.g., postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres

# Google Cloud Credentials
GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/mystwell-gcp-key.json # Path relative to Backend/server
GOOGLE_PROJECT_ID=YOUR_GCP_PROJECT_ID
GOOGLE_SPEECH_RECOGNIZER_NAME=projects/YOUR_GCP_PROJECT_ID/locations/global/recognizers/YOUR_RECOGNIZER_ID # e.g., projects/your-project/locations/global/recognizers/_

# Google Gemini API Key (if not using Application Default Credentials for Gemini)
# GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Redis Connection (for BullMQ Task Queue)
REDIS_HOST=localhost # Or your remote Redis host
REDIS_PORT=6379     # Or your remote Redis port
# REDIS_PASSWORD=YOUR_REDIS_PASSWORD # Uncomment and set if your Redis requires a password
# REDIS_USER=YOUR_REDIS_USER         # Uncomment and set if your Redis requires a username

# Optional: RLS Workaround Flag (Defaults to true if not set)
# USE_SERVICE_ROLE_FOR_RECORDINGS=true # Set to 'false' to attempt using standard client RLS (requires fixing auth context issue)

# Optional: Port
# PORT=3000
```

**How to get these values:**

-   **Supabase:** Find URL, Keys, and DB Connection String in your Supabase project settings (Project Settings > API & Database).
-   **Google Cloud:** See [Google Cloud Platform Setup](#google-cloud-platform-setup) below.
-   **Redis:** See [Redis Setup](#redis-setup-for-bullmq) below.

### Google Cloud Credentials

1.  Go to the GCP Console ([console.cloud.google.com](https://console.cloud.google.com)).
2.  Select your project.
3.  Navigate to **IAM & Admin > Service Accounts**.
4.  Click **+ CREATE SERVICE ACCOUNT**.
5.  Give it a name (e.g., `mystwell-backend-service`).
6.  Grant necessary roles:
    *   `Cloud Speech Administrator` (or more granular `roles/speech.recognizerRunner` if sufficient)
    *   `Vertex AI User` (or `roles/aiplatform.user` - needed for Gemini, adjust if using different Gemini API)
    *   Consider other roles if accessing different GCP services.
7.  Click **Done**.
8.  Find the created service account, click the three dots under **Actions**, and select **Manage keys**.
9.  Click **ADD KEY > Create new key**.
10. Choose **JSON** and click **CREATE**.
11. A JSON key file (e.g., `your-project-id-....json`) will download.
12. **Rename** this file (e.g., `mystwell-gcp-key.json`).
13. **Place** this file in a location accessible by the server (e.g., within `Backend/server` or a secure parent directory). **Crucially, ensure this file path is added to your root `.gitignore` file to prevent committing it.**
14. Update the `GOOGLE_APPLICATION_CREDENTIALS` path in your `.env` file to point to this key file (relative to the `Backend/server` directory).

## Installation

Install the necessary project dependencies:

```bash
npm install
```

## Running the Application

### Development Mode

Starts the server with auto-reloading on file changes.

```bash
npm run start:dev
```

The server will typically be available at `http://localhost:3000` (or the port specified in `.env`).

### Production Mode

Builds the application and starts the server in production mode.

```bash
# 1. Build the application
npm run build

# 2. Start the production server
npm run start:prod
```

## External Services Setup

### Supabase Setup

1.  **Create Project:** If you haven't already, create a new project on [supabase.com](https://supabase.com).
2.  **API Keys & DB URL:** Get your `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` from Project Settings > API & Database. Add them to your `.env` file.
3.  **Database Migrations:** Run the database migrations provided in this project (see [Database Migrations](#database-migrations-supabase)).
4.  **Storage Bucket:** Create a public storage bucket named `recordings` (Project Settings > Storage). Ensure appropriate storage policies are set if needed, although currently, signed URLs are used for access control during upload/playback.

### Google Cloud Platform Setup

1.  **Create Project:** Create a GCP project and enable billing.
2.  **Enable APIs:** Go to **APIs & Services > Library** and enable:
    *   **Cloud Speech-to-Text API**
    *   **Vertex AI API** (or the specific API endpoint used by the Gemini SDK you intend to use).
3.  **Service Account:** Create a service account and download the JSON key file as described in [Google Cloud Credentials](#google-cloud-credentials).
4.  **Speech Recognizer (V2):**
    *   You need to create a Speech V2 Recognizer resource. This defines the configuration (language, model features, etc.) for your transcription requests.
    *   This can be done via the `gcloud` CLI or potentially the GCP Console (Speech section). Refer to [Google Cloud Speech V2 Recognizer Docs](https://cloud.google.com/speech-to-text/v2/docs/recognizers).
    *   Once created, get the full resource name (e.g., `projects/your-project/locations/global/recognizers/your-recognizer-id`) and put it in the `GOOGLE_SPEECH_RECOGNIZER_NAME` variable in your `.env` file.
5.  **Project ID:** Get your GCP Project ID and add it to the `GOOGLE_PROJECT_ID` variable in `.env`.
6.  **Gemini API Key (Optional):** If the Gemini SDK requires an API key instead of using Application Default Credentials (ADC) via the service account file, generate one from the GCP console and add it to `GEMINI_API_KEY` in `.env`.

### Redis Setup (for BullMQ)

The application uses BullMQ for background job processing (transcription, analysis), which requires a Redis instance.

**Option 1: Local Docker Setup (Recommended for Development)**

1.  Ensure Docker is running.
2.  Run the following command in your terminal to start a Redis container:

    ```bash
    docker run --name mystwell-redis -p 6379:6379 -d redis
    ```

    *   `--name mystwell-redis`: Assigns a name to the container.
    *   `-p 6379:6379`: Maps port 6379 on your host to port 6379 in the container.
    *   `-d`: Runs the container in detached mode (background).
    *   `redis`: Specifies the official Redis image.

3.  Your `.env` file should have `REDIS_HOST=localhost` and `REDIS_PORT=6379`. No password is needed for the default Docker image unless you configure one.

**Option 2: Cloud Redis Provider**

Use a managed Redis service like Redis Cloud, AWS ElastiCache, Google Cloud Memorystore, etc. Configure the `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER` (if applicable), and `REDIS_PASSWORD` (if applicable) in your `.env` file accordingly.

## Database Migrations (Supabase)

This project uses the Supabase CLI to manage database schema changes and RLS policies.

1.  **Login:**
    ```bash
    supabase login
    ```
    (Follow prompts to authenticate with your Supabase account).

2.  **Link Project:** Navigate to `Backend/server` and link your local setup to your Supabase project:
    ```bash
    supabase link --project-ref YOUR_PROJECT_REF
    ```
    (Find `YOUR_PROJECT_REF` in your Supabase project's settings URL).

3.  **Apply Migrations:** Push the schema defined in your `supabase/migrations` folder to your linked Supabase database:
    ```bash
    supabase db push
    ```
    *Note: `db push` is suitable for development. For production, a more controlled migration workflow (`supabase migration up`) is recommended.*

The migration files are located in `src/supabase/migrations/`.

## Testing

Run the available tests:

```bash
# Run unit tests (if any)
npm run test

# Run end-to-end tests
npm run test:e2e
```

*Note: Test coverage is currently minimal and needs significant expansion.*

## API Endpoints

The server exposes RESTful endpoints under `/`. Key routes include:

-   `/` (GET): Basic health check.
-   `/auth/...`: Authentication endpoints (handled by Supabase client/redirects usually, specific backend routes might exist).
-   `/profiles/...`: User profile management.
-   `/recordings/...`: Recording management (CRUD, status updates, upload/playback URLs, retry).

Authentication is required for most endpoints, enforced by the `AuthGuard`. Refer to `src/**/**.controller.ts` files for detailed routes.

## Project Structure

```
Backend/server/
├── dist/                 # Compiled JavaScript output (after build)
├── node_modules/         # Project dependencies
├── src/                  # Source code
│   ├── app.module.ts     # Root application module
│   ├── main.ts           # Application entry point
│   ├── auth/             # Authentication module (Guard, Service)
│   ├── profile/          # Profile management module
│   ├── recording/        # Recording feature module (Controller, Service, Processor, Integrations)
│   └── supabase/         # Supabase integration (Client Module, Migrations)
├── test/                 # Test files (E2E)
├── .env                  # Environment variables (Gitignored)
├── .gitignore            # Git ignore rules
├── .prettierrc           # Prettier code formatter config
├── eslint.config.mjs     # ESLint configuration
├── mystwell-gcp-key.json # Google Cloud credentials (Example name, Gitignored)
├── nest-cli.json         # NestJS CLI configuration
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Dependency lock file
├── README.md             # This file
├── tsconfig.json         # TypeScript configuration
└── tsconfig.build.json   # TypeScript build configuration
```

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
