# EasyBus Backend

A production-ready backend for a bus booking system similar to RedBus, built with Node.js, Express, PostgreSQL, and Prisma.

This backend supports role-based access (ADMIN / USER), real-time seat blocking, safe booking transactions, and automatic cleanup of expired seat locks.

---

## 🚀 Tech Stack

- Node.js + Express
- PostgreSQL (Neon)
- Prisma ORM
- JWT Authentication
- node-cron (background jobs)

---

## 🏗 Architecture Overview

- **Auth Layer**
  - Email + password login
  - JWT-based authentication
  - Role-based authorization (ADMIN / USER)

- **Core Domain**
  - Buses with physical seats
  - Routes (source → destination)
  - Schedules per bus per date
  - Per-schedule seat availability

- **Concurrency Safety**
  - Seat blocking with TTL
  - Single active block session per user
  - All bookings done in transactions

---

## 👤 User Flow

1. Search buses by source, destination, and travel date
2. View available seats
3. Block one or more seats (max 6)
4. Enter passenger details
5. Confirm booking (dummy payment)
6. Seats become BOOKED

---

## 🛠 Admin Flow

All admin APIs are protected with `ADMIN` role.

- Add cities
- Add buses (auto-creates seats)
- Add routes
- Create schedules (auto-generates seat availability)
- View all bookings

---

## 🔐 Seat Blocking Logic

- Seats can be BLOCKED for 10 minutes
- Only one active block session per user at a time
- TTL is refreshed if the same user re-blocks
- Expired or invalid blocks are automatically released

---

## 💳 Booking Logic

- Only seats BLOCKED by the same user and not expired can be booked
- Booking confirmation runs inside a single transaction:
  - Seats: BLOCKED → BOOKED
  - Booking created
  - Passengers created
  - Dummy payment created
- Either everything succeeds or everything rolls back

---

## ⏱ Cron Job

A background job runs every minute to:
- Release expired BLOCKED seats
- Clean up invalid seat blocks
- Ensure no stale locks remain in the system

---

## 🔍 Search API

`GET /buses/search`

Supports:
- sourceCityId
- destinationId
- travelDate
- Pagination (page, limit)

Returns:
- Bus name and type
- Departure & arrival time
- Price
- Available seats count

Schedules with zero available seats are excluded.

---

## ⚙️ Setup Instructions

### 1. Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET=your_jwt_secret
PORT=5000
