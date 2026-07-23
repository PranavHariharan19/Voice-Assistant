# 🎙️ My Personal AI Dashboard

I built this project to solve my own daily organization and productivity needs. I wanted a single, unified personal dashboard where I could manage my schedule, keep track of daily recurring routines, store my private documents, and follow my favorite sports teams—all with a voice-first philosophy and a clean, responsive UI.

By integrating the **Google Gemini API**, I've created an AI assistant that understands natural voice and text commands, handling calendar operations and queries effortlessly.

---

## 🚀 Why I Built This

Traditional productivity apps are fragmented. Calendars require manual clicking, routine checklists live in separate todo apps, document storage requires external cloud drives, and sports schedules require searching multiple sites.

I wanted to consolidate everything into a single, cohesive dashboard with a **voice-first interface**:
- Speak commands directly to schedule, reschedule, or find events.
- Track daily routines that auto-reset every day.
- Access secure document vaults and sports fixtures instantly.

---

## ✨ Features I Use Daily

### 🧠 Voice & Text AI Assistant
Powered by the **Gemini API**, the embedded assistant processes spoken or typed commands in real-time:
- **Voice Scheduling**: *"Schedule a project review for next Tuesday at 4 PM."*
- **Instant Updates**: *"Reschedule my Tuesday meeting to Friday at 10 AM."*
- **Smart Queries**: *"Find all my dentist appointments from this month."*
- **Voice Feedback**: Spoken audio confirmation for all assistant actions.

### 📅 Interactive Calendar & Event Management
- **Full Calendar Views**: Month and year navigation with quick Jump-to-Today controls.
- **Category Filtering**: Instant filtering for *Quiz*, *Assignment*, and *Other* events.
- **Drag-and-Drop Rescheduling**: Drag any event chip directly onto a new date.
- **Today's Overview**: Dedicated card showing today's events at a glance.

### 📝 Persistent Daily Routine Tracker
- **Recurring Activities**: Checklist for daily activities independent of calendar dates.
- **Time Pickers**: Add optional times for routine tasks.
- **Automatic Daily Reset**: Tasks checked off today automatically reset to unticked the next day.
- **User Persistence**: Synced in local storage per logged-in user.

### 🗂️ Features Hub & Navigation
- **Quick Action Cards**: Dedicated hub in the sidebar for instant access to *Routine*, *Vault*, and *Sports*.
- **Seamless Panel Switching**: Clean embedded panel views with 1-click close buttons.

### 🛡️ Secure Document Vault
- **Private Vault**: Cloud document storage for PDFs, images, and notes.
- **Categorization & Search**: Filter and retrieve files instantly.

### 🏆 Sports Fixture Tracker
- Real-time match schedules for **Cricket** (India Men's/Women's, ICC events), **Formula 1**, **Football**,**Kabaddi**, and more.

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Vanilla CSS (Tailwind utilities, glassmorphism design system, dark/warm color palette)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Auth)
- **AI & Speech**: Google Gemini API & Web Speech API

---

## 📦 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/PranavHariharan19/Voice-Assistant.git
cd Voice-Assistant
npm install
```

### 2. Environment Variables
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

---

*Built with passion as a personal tool to make daily routine, calendar management, and productivity effortless.*
