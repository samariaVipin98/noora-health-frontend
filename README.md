## Rick & Morty AI Explorer (Noora Health Frontend)

**Rick & Morty AI Explorer** is a React + Vite frontend that combines:

- **GraphQL data** from the public Rick & Morty API for locations and characters
- **AI-powered dialogue generation and semantic search** via a separate backend (`VITE_BACKEND_URL`)
- **Rich UI/UX** built with Tailwind CSS, including carousels, modals, and AI metrics

The app lets you browse locations and residents, run natural-language AI searches over characters, generate AI scripts for a selected character, listen to those scripts via the browser’s speech synthesis, and attach your own notes to characters.

---

## Features

- **Location & Character Browser**
  - Fetches locations and residents from the Rick & Morty GraphQL API.
  - Horizontal **resident carousels** per location with smooth left/right scroll controls.
  - Pagination controls for navigating through multiple pages of locations.

- **AI Semantic Search**
  - Search characters using natural language (e.g. _“show me the dead aliens”_).
  - Displays:
    - Interpreted filters (status, species, episode, location)
    - Matching characters with status, species, and avatars.

- **AI Script Generation**
  - For a selected character, calls the backend to **generate a dialogue/script**.
  - Shows:
    - Generated dialogue lines (Rick/Morty style).
    - **Factual metrics** (name mention, status check).
    - **Creativity rubric** (1–5 stars and a textual reason).

- **Voice Narration (Web Speech API)**
  - Uses the browser’s speech synthesis to read AI-generated dialogue aloud.
  - Prefers English voices where available and alternates voices between speakers.
  - **Global mute/unmute toggle**:
    - Mute: cancels any ongoing narration.
    - Unmute: replays the entire script from the start.
  - Highlights the currently spoken line in the UI.

- **Field Notes per Character**
  - Create, list, and delete notes for a specific character.
  - Notes are persisted via backend APIs:
    - `GET /api/note?character_id=...`
    - `POST /api/note/save`
    - `POST /api/note/delete`

- **Robust UX States**
  - Loading state: _“Loading the Multiverse…”_.
  - Error state when the external GraphQL API fails.
  - Graceful handling of unexpected backend responses and network failures.

---

## Tech Stack

- **Framework**: React (with `StrictMode`)
- **Bundler/Dev Server**: Vite
- **Styling**: Tailwind CSS
- **Data Layer**:
  - `graphql-request` querying `https://rickandmortyapi.com/graphql`
  - Custom backend for AI & notes (configured via `VITE_BACKEND_URL`)
- **Speech**: Web Speech API (`window.speechSynthesis`)
- **Containerization**: Docker + Nginx (multi-stage build)

---

## Prerequisites

- **Node.js**: v18+ (Node 20 recommended, matches the Dockerfile)
- **npm**: v9+ (or any npm that ships with your Node version)
- **Backend API**:
  - A running backend that exposes:
    - `POST /api/dialogue/generate`
    - `POST /api/search`
    - `GET /api/note`
    - `POST /api/note/save`
    - `POST /api/note/delete`
  - The backend base URL must be provided via `VITE_BACKEND_URL`.

---

## Local Setup (Without Docker)

### 1. Clone the repository

```bash
git clone <your-repo-url> noora-health-frontend
cd noora-health-frontend
```

### 2. Install dependencies

```bash
npm ci
```

If you prefer `npm install`, that also works, but `npm ci` is recommended for reproducible installs.

### 3. Configure environment variables

Create a `.env` file in the project root (same folder as `package.json`) and set the backend URL:

```bash
echo "VITE_BACKEND_URL=http://localhost:8000" > .env
```

Adjust the URL to match where your backend is running.

### 4. Run the development server

```bash
npm run dev
```

By default, Vite will start on something like `http://localhost:5173`. Follow the terminal output for the exact URL.

### 5. Build for production (optional)

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## Running via Docker

This project includes a multi-stage Dockerfile that builds the Vite app and serves it via Nginx.

### 1. Build the Docker image

From the project root:

```bash
docker build -t noora-health-frontend:latest .
```

### 2. Run the container

You can use the provided helper script:

```bash
chmod +x docker_run.sh
./docker_run.sh
```

This will:

- Build the Docker image `noora-health-frontend:latest`.
- Stop and remove any existing container named `noora-health-frontend`.
- Run a new container, mapping **host port 3000 → container port 80**.

You can then access the app at:

- `http://localhost:3000`

> **Note**: To configure `VITE_BACKEND_URL` for Docker builds, you can:
> - Bake it into the image using a build-time `.env` file, or
> - Adjust the Dockerfile / Nginx config to proxy to your backend.

---

## Project Scripts

Available npm scripts (see `package.json`):

- **`npm run dev`**: Start Vite dev server.
- **`npm run build`**: Create a production build in `dist/`.
- **`npm run preview`**: Preview the built app locally.
- **`npm run lint`**: Run ESLint on the project.

---

## High-Level Architecture

- **`src/App.jsx`**
  - Main UI/UX: locations list, resident carousels, AI search results, modal, notes, and speech controls.
- **`src/services/ExternalAPIService.js`**
  - Fetches locations and residents via GraphQL (`graphql-request`) from the public Rick & Morty API.
- **`src/services/BackendAPIService.js`**
  - Wraps calls to your backend using `VITE_BACKEND_URL` for:
    - Dialogue generation
    - Semantic search
    - Notes CRUD operations.
- **`src/main.jsx`**
  - React entrypoint that mounts `App` into `#root`.

---

## Notes & Limitations

- The app depends on:
  - The public Rick & Morty GraphQL API being reachable.
  - A correctly configured backend at `VITE_BACKEND_URL`.
- If the backend is unreachable or returns errors:
  - Dialogue generation falls back to an error message with low rubric score.
  - Semantic search gracefully returns no structured results.

If you extend this app (e.g., new AI features, more metrics, or additional visualizations), consider updating this README to reflect the new capabilities.
