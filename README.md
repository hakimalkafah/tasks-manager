# Tasks Manager

A modern task management application built with Next.js, Convex, Clerk, and shadcn/ui.

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Convex for real-time database and API
- **Authentication**: Clerk for user management
- **UI Components**: shadcn/ui
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Clerk account
- A Convex account

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tasks-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

Fill in your environment variables:
- Get Clerk keys from [clerk.com](https://clerk.com)
- Get Convex URL from [convex.dev](https://convex.dev)

4. Set up Convex:
```bash
npx convex dev
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Convex
CONVEX_DEPLOYMENT=your_convex_deployment_url_here
NEXT_PUBLIC_CONVEX_URL=https://your_convex_deployment.convex.cloud
```

## Features

- User authentication with Clerk
- Real-time task management
- Task priorities and due dates
- Responsive design with Tailwind CSS
- Modern UI components with shadcn/ui

## Deployment

### Vercel

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
   - **CLERK_SECRET_KEY** must be set to a valid key so server-side Clerk SDK calls (e.g. profile updates) work in production
3. Deploy automatically on push to main branch

### Convex

1. Run `npx convex deploy` to deploy your backend
2. Update your environment variables with the production Convex URL

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx convex dev` - Start Convex development mode

## Project Structure

```
src/
├── app/                 # Next.js app directory
├── components/          # React components
│   └── ui/             # shadcn/ui components
├── lib/                # Utility functions
├── providers/          # Context providers
└── middleware.ts       # Clerk middleware

convex/
├── schema.ts           # Database schema
├── tasks.ts           # Task-related functions
└── _generated/        # Generated Convex files
```
