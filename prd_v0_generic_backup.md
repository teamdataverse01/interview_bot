Since you're now at the build stage, don't write a generic PRD. Write an **implementation PRD** that tells you exactly what to build for V1.

# Product Requirements Document (PRD)

## Product Name

Dataverse AI Interview Coach

## Version

MVP 1.0

## Product Owner

Elizabeth (Dataverse)

## Technical Lead

Mubarak

---

# 1. Product Vision

Dataverse AI Interview Coach is an AI-powered interview simulation platform that helps job seekers practice realistic interviews using conversational AI trained on real interview experiences and coaching materials.

The platform should provide a realistic mock interview experience that adapts to user responses and mimics a professional interviewer.

The long-term goal is to reduce the need for repetitive one-on-one coaching sessions while allowing clients to practice anytime.

---

# 2. Problem Statement

Currently, interview preparation requires significant manual coaching time.

Challenges:

* Limited coaching capacity
* Repetitive interview practice sessions
* Clients require practice outside coaching hours
* Difficult to scale coaching services

The AI Interview Coach should provide realistic interview practice on demand.

---

# 3. Target Users

Primary Users:

* Job seekers
* Graduate applicants
* Professionals preparing for interviews
* Dataverse coaching clients

Secondary Users:

* Corporate training clients
* University students
* Career transition candidates

---

# 4. MVP Success Criteria

A successful MVP should allow a user to:

1. Create an account
2. Login securely
3. Start an interview session
4. Answer interview questions
5. Receive intelligent follow-up questions
6. Complete an interview session
7. Review previous sessions

---

# 5. MVP Features

## Feature 1: Authentication

Users should be able to:

* Sign up
* Login
* Logout
* Reset password

Provider:

* Supabase Auth

---

## Feature 2: Dashboard

After login users should see:

* Welcome screen
* Available interview modes
* Credits remaining
* Previous interview sessions

---

## Feature 3: Interview Modes

MVP modes:

### General Interview

Standard professional interview simulation.

### Behavioral Interview

Focus on:

* Leadership
* Teamwork
* Conflict resolution
* Communication

### HR Interview

Focus on:

* Motivation
* Career goals
* Personal strengths
* Organizational fit

---

## Feature 4: AI Interview Agent

The AI interviewer must:

* Act like a professional interviewer
* Ask one question at a time
* Evaluate previous responses
* Generate relevant follow-up questions
* Maintain interview flow
* Avoid repeating questions

---

## Feature 5: Interview State Manager

This is mandatory.

Every interview session must track:

### Stage 1

Introduction

Questions:

* Tell me about yourself
* Walk me through your background

### Stage 2

Experience

Questions related to:

* Work experience
* Projects
* Achievements

### Stage 3

Behavioral Assessment

Questions around:

* Leadership
* Challenges
* Teamwork

### Stage 4

Role Fit

Questions related to:

* Motivation
* Company fit
* Career goals

### Stage 5

Closing

Questions:

* Any questions for me?
* Final feedback

The AI should move between stages logically.

---

# 6. Knowledge Architecture

## Layer 1: Foundation Model

Model:

* DeepSeek
* Qwen
* Grok

Provides:

* General knowledge
* Interview best practices
* Communication standards
* Professional interviewing knowledge

---

## Layer 2: RAG Knowledge Base

Source:

Current interview transcripts.

Additional future sources:

* Coaching notes
* Interview preparation materials
* Mock interview examples
* Company-specific interview experiences

Purpose:

* Mimic Elizabeth's interview style
* Provide realistic interview patterns
* Improve follow-up quality

---

# 7. Session Memory

The system should remember:

* Previous answers
* Previously asked questions
* User strengths
* User weaknesses
* Topics already discussed

Memory lasts for the duration of the interview session.

---

# 8. Credits System

Users receive credits.

Example:

1 Interview Session = 1 Credit

Actions:

* Start session
* Deduct credit
* Display remaining balance

Admin can manually adjust credits.

---

# 9. Admin Panel (MVP)

Admin should be able to:

* View users
* View sessions
* Upload transcripts
* Add interview documents
* Adjust credits

No advanced analytics required for MVP.

---

# 10. Database Schema

Users

* id
* email
* created_at

Credits

* user_id
* balance

Sessions

* session_id
* user_id
* mode
* start_time
* end_time

Messages

* id
* session_id
* sender
* content
* timestamp

Documents

* id
* title
* source
* embedding_id

---

# 11. Technical Stack

Frontend

* Next.js
* Tailwind

Backend

* FastAPI

Database

* Supabase PostgreSQL

Vector Storage

* pgvector

Hosting

* Vercel
* Railway

AI

* OpenRouter
* DeepSeek or Qwen

RAG

* LlamaIndex

---

# 12. Future Features (Phase 2)

Not included in MVP.

Future roadmap:

* Voice interviews
* Resume upload
* Resume-aware interviews
* AI scoring
* Feedback reports
* Company-specific interview packs
* Analytics dashboard
* Subscription billing
* Video interviews
* Enterprise accounts

---

# 13. Development Milestones

Week 1

* Supabase setup
* Railway deployment
* Transcript cleaning
* RAG ingestion

Week 2

* Interview agent
* Session memory
* Interview state manager

Week 3

* Frontend dashboard
* Authentication
* Session history

Week 4

* Credits system
* Admin panel
* Testing
* Deployment

---

# MVP Definition of Done

The MVP is complete when:

* Users can sign up
* Users can start interviews
* AI conducts structured interviews
* RAG retrieves transcript knowledge
* Session history is saved
* Credits are tracked
* Platform is deployed and usable by real clients

One architectural recommendation: **don't build "chatbot first." Build the Interview State Manager first.** The state manager is what will make the product feel like a real interviewer instead of a generic AI chat assistant with RAG attached.
Since you're now at the build stage, don't write a generic PRD. Write an **implementation PRD** that tells you exactly what to build for V1.

# Product Requirements Document (PRD)

## Product Name

Dataverse AI Interview Coach

## Version

MVP 1.0


## Technical Lead

Mubarak

---

# 1. Product Vision

Dataverse AI Interview Coach is an AI-powered interview simulation platform that helps job seekers practice realistic interviews using conversational AI trained on real interview experiences and coaching materials.

The platform should provide a realistic mock interview experience that adapts to user responses and mimics a professional interviewer.

The long-term goal is to reduce the need for repetitive one-on-one coaching sessions while allowing clients to practice anytime.

---

# 2. Problem Statement

Currently, interview preparation requires significant manual coaching time.

Challenges:

* Limited coaching capacity
* Repetitive interview practice sessions
* Clients require practice outside coaching hours
* Difficult to scale coaching services

The AI Interview Coach should provide realistic interview practice on demand.

---

# 3. Target Users

Primary Users:

* Job seekers
* Graduate applicants
* Professionals preparing for interviews
* Dataverse coaching clients

Secondary Users:

* Corporate training clients
* University students
* Career transition candidates

---

# 4. MVP Success Criteria

A successful MVP should allow a user to:

1. Create an account
2. Login securely
3. Start an interview session
4. Answer interview questions
5. Receive intelligent follow-up questions
6. Complete an interview session
7. Review previous sessions

---

# 5. MVP Features

## Feature 1: Authentication

Users should be able to:

* Sign up
* Login
* Logout
* Reset password

Provider:

* Supabase Auth

---

## Feature 2: Dashboard

After login users should see:

* Welcome screen
* Available interview modes
* Credits remaining
* Previous interview sessions

---

## Feature 3: Interview Modes

MVP modes:

### General Interview

Standard professional interview simulation.

### Behavioral Interview

Focus on:

* Leadership
* Teamwork
* Conflict resolution
* Communication

### HR Interview

Focus on:

* Motivation
* Career goals
* Personal strengths
* Organizational fit

---

## Feature 4: AI Interview Agent

The AI interviewer must:

* Act like a professional interviewer
* Ask one question at a time
* Evaluate previous responses
* Generate relevant follow-up questions
* Maintain interview flow
* Avoid repeating questions

---

## Feature 5: Interview State Manager

This is mandatory.

Every interview session must track:

### Stage 1

Introduction

Questions:

* Tell me about yourself
* Walk me through your background

### Stage 2

Experience

Questions related to:

* Work experience
* Projects
* Achievements

### Stage 3

Behavioral Assessment

Questions around:

* Leadership
* Challenges
* Teamwork

### Stage 4

Role Fit

Questions related to:

* Motivation
* Company fit
* Career goals

### Stage 5

Closing

Questions:

* Any questions for me?
* Final feedback

The AI should move between stages logically.

---

# 6. Knowledge Architecture

## Layer 1: Foundation Model

Model:

* DeepSeek
* Qwen
* Grok

Provides:

* General knowledge
* Interview best practices
* Communication standards
* Professional interviewing knowledge

---

## Layer 2: RAG Knowledge Base

Source:

Current interview transcripts.

Additional future sources:

* Coaching notes
* Interview preparation materials
* Mock interview examples
* Company-specific interview experiences

Purpose:

* Mimic Elizabeth's interview style
* Provide realistic interview patterns
* Improve follow-up quality

---

# 7. Session Memory

The system should remember:

* Previous answers
* Previously asked questions
* User strengths
* User weaknesses
* Topics already discussed

Memory lasts for the duration of the interview session.

---

# 8. Credits System

Users receive credits.

Example:

1 Interview Session = 1 Credit

Actions:

* Start session
* Deduct credit
* Display remaining balance

Admin can manually adjust credits.

---

# 9. Admin Panel (MVP)

Admin should be able to:

* View users
* View sessions
* Upload transcripts
* Add interview documents
* Adjust credits

No advanced analytics required for MVP.

---

# 10. Database Schema

Users

* id
* email
* created_at

Credits

* user_id
* balance

Sessions

* session_id
* user_id
* mode
* start_time
* end_time

Messages

* id
* session_id
* sender
* content
* timestamp

Documents

* id
* title
* source
* embedding_id

---

# 11. Technical Stack

Frontend

* Next.js
* Tailwind

Backend

* FastAPI

Database

* Supabase PostgreSQL

Vector Storage

* pgvector

Hosting

* Vercel
* Railway

AI

* OpenRouter
* DeepSeek or Qwen

RAG

* LlamaIndex

---

# 12. Future Features (Phase 2)

Not included in MVP.

Future roadmap:

* Voice interviews
* Resume upload
* Resume-aware interviews
* AI scoring
* Feedback reports
* Company-specific interview packs
* Analytics dashboard
* Subscription billing
* Video interviews
* Enterprise accounts

---

# 13. Development Milestones

Week 1

* Supabase setup
* Railway deployment
* Transcript cleaning
* RAG ingestion

Week 2

* Interview agent
* Session memory
* Interview state manager

Week 3

* Frontend dashboard
* Authentication
* Session history

Week 4

* Credits system
* Admin panel
* Testing
* Deployment

---

# MVP Definition of Done

The MVP is complete when:

* Users can sign up
* Users can start interviews
* AI conducts structured interviews
* RAG retrieves transcript knowledge
* Session history is saved
* Credits are tracked
* Platform is deployed and usable by real clients

One architectural recommendation: **don't build "chatbot first." Build the Interview State Manager first.** The state manager is what will make the product feel like a real interviewer instead of a generic AI chat assistant with RAG attached.
