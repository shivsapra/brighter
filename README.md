# ✨ Brighter — Illuminate Your World (Phase 1)

Brighter is a next-generation social video platform inspired by TikTok, built with a charcoal starlight aesthetic, original **BS + Star** branding, and real Supabase PostgreSQL & Authentication.

---

## 🚀 Features Implemented (Phase 1)

### 1. Real User Profiles & Supabase Storage
- **Profile Picture Management**: Users can upload real image files (PNG, JPG, WebP) directly to the Supabase Storage `avatars` bucket, change their photo, or remove it with instant database synchronization.
- **Profile Editing**: Real-time updates for display name, unique `@username`, and bio with immediate persistence to PostgreSQL.
- **Uniqueness & Security**: Live validation ensuring `@username` is strictly unique and Row Level Security preventing users from editing another user's profile.

### 2. Real User Search (Discover Page)
- **Live Search Bar**: Search registered creators in real-time by username or display name against Supabase PostgreSQL.
- **Zero Mock Data**: Never displays fake or simulated accounts.
- **Creator Cards**: Displays real avatar (or glowing monogram initial), display name, `@username`, and bio snippet.
- **Direct Navigation**: Clicking any search result opens that creator's profile seamlessly with a back button.
- **Empty & Error States**: Clear feedback when searching, when no creators match, or when connectivity needs attention.

### 3. Real Follow & Unfollow System
- **Database Follows Table (`public.follows`)**: Tracks `follower_id` and `following_id` with foreign keys and cascade deletion.
- **Self-Follow Prevention**: Enforced at both UI level and database constraint (`check (follower_id != following_id)`).
- **Accurate Real-Time Counters**: Followers and following counts computed from actual database records.
- **User Posts Grid**: Real post history fetched per user with video/image previews and styled empty state when no posts exist.
- **TikTok-Style Feed**: Shows public sparks on *For You* and filtered sparks from followed creators on *Following*.

### 4. Responsive Mobile & Desktop Layout
- **Charcoal & Radiant Gold Aesthetic**: Preserved obsidian/charcoal theme (`#08090C`, `#101217`) with warm starlight gold accents (`#FFD15C`, `#F59E0B`).
- **Fixed Mobile Bottom Navigation**: Replaces desktop sidebar on mobile viewports with no horizontal scroll and clean Android screen padding.
- **Dual Mode**: Full Light and Dark Mode support with smooth toggling and persistence.

---

## 🛠️ Step-by-Step Supabase Setup

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project** and name it `brighter-app`.

### 2. Run Database Schema
1. Open your Supabase Dashboard and click **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open [`supabase_schema.sql`](file:///c:/Users/Shivs/OneDrive/Desktop/firstapp/supabase_schema.sql) in this repository, copy its entire contents, and paste it into the SQL Editor.
4. Click **Run**. This creates:
   - The `profiles` table.
   - Row Level Security (RLS) policies.
   - Automatic user creation trigger on `auth.users`.
   - The `avatars` storage bucket with public access policies.

### 3. Configure Authentication Settings (Optional for Testing)
1. Go to **Authentication** &rarr; **Providers** &rarr; **Email**.
2. Make sure **Enable Email provider** is turned on.
3. *(Optional for Instant Testing)*: You can toggle off **Confirm email** if you want new accounts to log in immediately without waiting for verification emails.

### 4. Add Environment Variables
Create a file named `.env` in the root folder with your keys:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```
> **Note**: You can also configure credentials directly within the app by clicking the **Connect Supabase** button on the welcome screen.

---

## 🏃 Running the App Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the Vite development server
npm run dev

# 3. Open in browser
http://localhost:5173
```

---

## 📦 Building for Production

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📁 Project Architecture

```
firstapp/
├── index.html                   # Entry HTML with Outfit & Plus Jakarta Sans
├── public/
│   └── logo.svg                 # Custom BS + Star brand vector
├── src/
│   ├── components/
│   │   ├── app/
│   │   │   ├── AppShell.tsx         # Main post-auth layout
│   │   │   ├── BottomNav.tsx        # Mobile TikTok bottom navigation
│   │   │   ├── CreatePostModal.tsx  # Video upload & caption modal
│   │   │   ├── DesktopSidebar.tsx   # Tablet & desktop sidebar navigation
│   │   │   ├── EditProfileModal.tsx # Supabase profile updater
│   │   │   ├── HomeFeed.tsx         # Vertical feed & empty state
│   │   │   ├── MessagesInbox.tsx    # Direct messages & notifications
│   │   │   ├── SearchDiscover.tsx   # Live creator search & trending tags
│   │   │   └── UserProfile.tsx      # Profile view with stats & tabs
│   │   ├── auth/
│   │   │   ├── AuthContainer.tsx    # Auth state transition manager
│   │   │   ├── ForgotPasswordModal.tsx # Supabase password recovery
│   │   │   ├── LoginForm.tsx        # Real email/password login
│   │   │   ├── SignUpForm.tsx       # Live validated registration
│   │   │   ├── UpdatePasswordModal.tsx # Password reset handler
│   │   │   └── WelcomeScreen.tsx    # Hero screen with BS + Star logo
│   │   └── common/
│   │       ├── BrighterLogo.tsx     # Reusable BS + Star monogram component
│   │       ├── LoadingScreen.tsx    # Pulsing starlight loader
│   │       ├── StarfieldBackground.tsx # Canvas starlight particles engine
│   │       └── SupabaseConfigModal.tsx # In-app Supabase connection assistant
│   ├── context/
│   │   ├── AuthContext.tsx      # Supabase Auth, profiles & session state
│   │   ├── ThemeContext.tsx     # Dark & Light mode management
│   │   └── ToastContext.tsx     # Toast notification system
│   ├── lib/
│   │   └── supabase.ts          # Supabase client & profile queries
│   ├── types/
│   │   └── database.ts          # Database TypeScript interfaces
│   ├── App.css                  # Component styling & responsiveness
│   ├── App.tsx                  # App root router
│   ├── index.css                # Obsidian/Charcoal & Gold design system
│   └── main.tsx                 # React DOM mount
├── .env.example                 # Environment variables template
├── supabase_schema.sql          # Complete Supabase PostgreSQL schema
└── package.json                 # Project dependencies
```
