# Frame.io Upload Dashboard

A web application that allows clients and team members to upload video files directly to Frame.io without needing a Frame.io account. Admins control which folders are visible to uploaders.

## Live URLs

- **Upload Portal**: https://frameio-dashboard.vercel.app
- **Admin Panel**: https://frameio-dashboard.vercel.app/admin
- **GitHub**: https://github.com/jaymdenn/frameio-dashboard
- **Supabase**: https://supabase.com/dashboard/project/bgaavbgpdsmzjwqjwefh

## Features

- **Public Upload Portal**: Drag-and-drop video upload with real-time progress
- **Direct-to-Frame.io Upload**: Files upload directly to Frame.io (no file size limit)
- **Admin Control**: Select which Frame.io folders are available for uploads
- **Upload Logging**: Full audit trail of all uploads with filtering and CSV export
- **Secure**: Frame.io API token never exposed to browser

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Auth)
- **Hosting**: Vercel
- **Storage**: Frame.io (5TB account)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Frame.io account with API access
- Vercel account (for deployment)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd frameio-dashboard
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project
2. Run the migration to create tables:

```bash
# Copy the contents of supabase/migrations/20260404000000_initial_schema.sql
# and run it in the Supabase SQL Editor
```

3. Add yourself as an admin:

```sql
-- First, sign up through the app, then run:
INSERT INTO admins (id, email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Frame.io
FRAMEIO_API_TOKEN=your-frameio-api-token
```

### 4. Get Frame.io API Token

1. Go to [Frame.io Developer Portal](https://developer.frame.io/)
2. Create a new application
3. Generate an API token with read/write access
4. Add the token to your environment variables

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the upload portal.
Open [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and import your GitHub repository
2. Add environment variables in Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FRAMEIO_API_TOKEN`

3. Deploy!

## Usage

### For Uploaders

1. Go to the upload portal URL
2. (Optional) Enter your name and email for attribution
3. Select a destination folder from the dropdown
4. Drag and drop your video file
5. Wait for upload to complete

### For Admins

1. Log in at `/admin/login`
2. Go to **Folders** to sync and enable Frame.io folders
3. View upload logs in **Upload Logs**
4. Manage admin users in **Settings**

### Project-Specific Links

Share links with `?project=<project-id>` to pre-filter folders:

```
https://your-domain.com/?project=abc123
```

## Architecture

### Upload Flow

1. User selects file and destination
2. Browser sends metadata to `/api/upload/initiate`
3. Server creates Frame.io asset and returns upload URLs
4. Browser uploads chunks directly to Frame.io (bypasses server)
5. Browser notifies `/api/upload/complete` when done
6. Upload logged in Supabase

### Security

- Frame.io API token stored in server environment only
- Rate limiting: 10 uploads per IP per hour
- RLS policies protect all Supabase tables
- Admin routes require authentication

## Database Schema

### Tables

- `admins` - Admin user records
- `frameio_folders` - Synced Frame.io folder tree
- `upload_events` - Upload audit log
- `settings` - Configuration storage

See `supabase/migrations/` for full schema.

## File Structure

```
src/
├── app/
│   ├── page.tsx              # Public upload page
│   ├── admin/
│   │   ├── login/            # Admin login
│   │   ├── dashboard/        # Admin dashboard
│   │   ├── folders/          # Folder management
│   │   ├── logs/             # Upload logs
│   │   └── settings/         # Settings
│   └── api/
│       ├── upload/           # Upload endpoints
│       ├── folders/          # Folder listing
│       └── frameio/          # Frame.io sync
├── components/
│   ├── ui/                   # Reusable UI components
│   ├── upload/               # Upload-specific components
│   └── admin/                # Admin components
├── hooks/
│   └── useChunkedUpload.ts   # Chunked upload logic
├── lib/
│   ├── frameio.ts            # Frame.io API client
│   ├── supabase/             # Supabase clients
│   └── utils.ts              # Utility functions
└── types/
    └── database.ts           # TypeScript types
```

## License

MIT
