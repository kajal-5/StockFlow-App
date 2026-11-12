# Stock_Flow_project

The project is split into two folders:

- `frontend/src/pages/` — Login/signup, dashboard, products, and settings screens.
- `frontend/src/components/` — Shared sidebar, brand, product form, and product table.
- `frontend/src/lib/api.js` — Frontend helper for calling the backend.
- `frontend/` — React, JavaScript, Vite, and Tailwind CSS app setup.
- `backend/` — Express API, authentication, and SQLite database (`stockflow.db` is created automatically).

Both run through the backend on the same port (`3001` by default; set `PORT` to change it).

## Run locally

1. Install Node.js LTS from https://nodejs.org/.
2. From this project folder, run `npm install`.
3. Run `npm run dev` and open http://localhost:3001.

For a production build, run `npm run build` and then `npm start`. Before deploying, set a private `SESSION_SECRET` and configure a persistent session store.
