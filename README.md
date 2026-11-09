# 4-Step Queue Management System — Step 1

## Requirements
- Node.js 22.12+ or a compatible current LTS
- MongoDB Community Server running locally, or MongoDB Atlas

## Start backend
```powershell
cd server
Copy-Item .env.example .env
npm install
npm run dev
```
Adjust `MONGODB_URI` in `.env` before running if necessary.

## Start frontend (new terminal)
```powershell
cd client
npm install
npm run dev
```
Visit http://localhost:5173 and http://localhost:5000/api/health.

## Existing Vite project
If you already have a working Vite project, you can either use this complete starter as a separate folder, or merge the client files carefully into your existing frontend. Back up your existing files before replacing anything.

## Security scope
Development-only starter: do not deploy publicly until login, RBAC, TLS, hardened Socket.IO authorization, monitoring, and deployment configuration are implemented. The health endpoint is deliberately non-sensitive.
