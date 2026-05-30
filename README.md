# Peso Pilot — USD/PHP Foreign Exchange Analytics Dashboard

A modern, full-stack foreign exchange analytics platform built with **Next.js**, **TypeScript**, **PostgreSQL**, and **Prisma** that automatically ingests official USD/PHP exchange rates from the **Bangko Sentral ng Pilipinas (BSP)** and transforms them into an interactive analytics dashboard.

---

## Overview

Peso Pilot is a data-driven FX dashboard designed to provide historical and real-time insights into the Philippine Peso (PHP) against the US Dollar (USD).

The platform automatically:

- Scrapes official BSP exchange rate data
- Stores historical rates in PostgreSQL
- Prevents duplicate records through idempotent upserts
- Serves clean API endpoints for frontend consumption
- Visualizes exchange rate trends through interactive charts
- Supports custom date filtering and time-period analysis

---

## Features

### Interactive Dashboard

- Dark Mode / Light Mode toggle
- Responsive UI
- Interactive historical FX chart
- Hover tooltips
- Brush zoom controls
- KPI cards
- Custom date filtering
- Preset time ranges:
  - 7 Days
  - 30 Days
  - 90 Days
  - Year-to-Date

---

### FX Analytics

Monitor:

- Latest USD/PHP exchange rate
- Daily price movement
- Daily percentage change
- Period highs
- Period lows
- Historical trends

---

### Automated BSP Data Pipeline

The application ingests data directly from:

https://www.bsp.gov.ph/statistics/external/day99_data.aspx

The pipeline:

1. Fetches BSP HTML data
2. Parses monthly FX tables
3. Detects table headers dynamically
4. Extracts daily exchange rates
5. Converts dates into normalized UTC timestamps
6. Stores records into PostgreSQL
7. Uses Prisma upserts to prevent duplicates

---

## Architecture

```text
┌─────────────────────┐
│ BSP Statistics Page │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Cheerio + Axios     │
│ Scraper             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Prisma ORM          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ PostgreSQL          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Next.js API Routes  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ React Dashboard     │
│ Recharts            │
└─────────────────────┘
```

---

# Technology Stack

### Frontend

- Next.js (App Router)
- React
- TypeScript
- Recharts

### Backend

- Next.js API Routes
- Prisma ORM

### Database

- PostgreSQL 18

### Data Engineering

- Axios
- Cheerio
- TypeScript Scripts

### Tooling

- ts-node
- pgAdmin
- npm

---

# Project Structure

```text
fx-dashboard/
│
├── app/
│   ├── api/
│   │   └── rates/
│   │       ├── latest/
│   │       ├── last/
│   │       └── range/
│   │
│   ├── ui/
│   │   └── DashboardClient.tsx
│   │
│   └── page.tsx
│
├── lib/
│   ├── prisma.ts
│   └── fxApi.ts
│
├── prisma/
│   └── schema.prisma
│
├── scripts/
│   └── importBspRates.ts
│
└── package.json
```

---

# Database Schema

```prisma
model ExchangeRate {
  id        Int      @id @default(autoincrement())
  date      DateTime
  pair      String
  rate      Decimal  @db.Numeric(12,6)
  source    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([pair, date])
}
```

### Why the Unique Constraint?

```prisma
@@unique([pair, date])
```

Guarantees that:

- One USD/PHP record exists per date
- Running imports multiple times never creates duplicates
- Data ingestion remains idempotent

---

# Data Ingestion

The scraper:

```bash
npm run import:bsp
```

Performs:

### Step 1

Fetch BSP statistics page

```ts
axios.get(...)
```

### Step 2

Parse HTML

```ts
cheerio.load(...)
```

### Step 3

Locate:

```text
DAILY PHILIPPINE PESO PER US DOLLAR RATE
```

table

### Step 4

Extract month columns

Example:

```text
Jan-25
Feb-25
Mar-25
...
Jan-26
```

### Step 5

Extract day rows

```text
1
2
3
...
31
```

### Step 6

Construct normalized dates

```ts
Date.UTC(...)
```

### Step 7

Upsert into PostgreSQL

```ts
prisma.exchangeRate.upsert(...)
```

---

# API Endpoints

## Latest Rate

### Request

```http
GET /api/rates/latest
```

### Response

```json
{
  "pair": "USD/PHP",
  "source": "BSP",
  "date": "2026-01-31",
  "rate": "58.240"
}
```

---

## Last N Records

### Request

```http
GET /api/rates/last?n=90
```

### Response

```json
{
  "pair": "USD/PHP",
  "source": "BSP",
  "count": 90,
  "data": [...]
}
```

---

## Custom Date Range

### Request

```http
GET /api/rates/range?start=2025-01-01&end=2025-06-01
```

### Response

```json
{
  "pair": "USD/PHP",
  "data": [...]
}
```

---

# Dashboard Metrics

Current dashboard computes:

### Live Rate

Most recent BSP business-day exchange rate.

### Daily Change

```text
Current Rate - Previous Rate
```

### Daily Percentage Change

```text
(Current - Previous) / Previous
```

### Range Low

Minimum value within selected period.

### Range High

Maximum value within selected period.

---

# Dashboard Features

### Theme Switching

Persistent Dark Mode

```text
🌙 Light
🌞 Dark
```

using:

```js
localStorage
```

---

### Interactive Chart

Built with:

```bash
Recharts
```

Includes:

- Area chart
- Dynamic tooltips
- Brush zoom
- Responsive resizing
- Smooth animations

---

### Date Range Filtering

Users can:

- Select custom start date
- Select custom end date
- Run custom analysis

Example:

```text
2025-01-01 → 2025-06-01
```

---

# Performance Considerations

### No Duplicate Records

Achieved through:

```ts
upsert()
```

and

```prisma
@@unique([pair, date])
```

---

### Fresh Data Fetching

Dashboard requests use:

```ts
cache: "no-store"
```

to ensure latest available rates are displayed.

---

### Safe Range Validation

The frontend automatically normalizes:

```text
start <= end
```

before querying the API.

This prevents:

```text
400 Bad Request
```

errors.

---

# Planned Features

## Forecasting Engine

Planned implementation:

- Forecast horizon slider
- Projected FX path
- Dashed prediction line
- Trend-based forecasting

Potential models:

- Linear Regression
- Moving Average Forecast
- Prophet
- ARIMA

---

## Advanced Analytics

Planned indicators:

### Moving Averages

- MA7
- MA30
- MA90

### Volatility

```text
Rolling Standard Deviation
```

### Drawdown Analysis

Largest declines from local highs.

### Trend Detection

Bullish / Bearish momentum indicators.

---

## Automation

Future deployment will include:

### Scheduled Imports

Automatic BSP refresh via:

- Vercel Cron Jobs
- GitHub Actions
- Server Cron

### Daily Pipeline

```text
BSP
 ↓
Scraper
 ↓
Postgres
 ↓
Dashboard
```

without manual intervention.

---

# Getting Started

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/fx-dashboard.git
```

## Install Dependencies

```bash
npm install
```

## Configure Environment

Create:

```bash
.env
```

```env
DATABASE_URL="postgresql://..."
```

---

## Run Prisma

```bash
npx prisma migrate dev
```

```bash
npx prisma generate
```

---

## Import Historical BSP Data

```bash
npm run import:bsp
```

---

## Start Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Screenshots

(Add screenshots here once deployed)

```markdown
![Dashboard](./screenshots/dashboard.png)
```

---


# License

This project is licensed under the MIT License.

---

## Acknowledgements

- Bangko Sentral ng Pilipinas (BSP)
- Prisma
- PostgreSQL
- Next.js
- Recharts
- Open Source Community

Built to explore financial data engineering, analytics, and quantitative dashboard development using modern full-stack technologies.
