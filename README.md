# GustoSphere | Heritage, Cuisine & Age-Adaptive Dining Explorer

A rich, high-performance web platform built with **C++ (POSIX socket HTTP server & REST API)**, **HTML5**, **Vanilla CSS**, and **JavaScript**.

It allows users to discover, filter, and scroll through dining options curated by:
1. **Culinary Tradition & Heritage** (Ancestral Heritage, Contemporary Fusion, Street Food & Night Market, Ceremonial & Feasts)
2. **World Cuisine Origins** (Japanese, Italian, Indian, Mexican, Mediterranean, French, Pan-Asian, Thai, Spanish)
3. **Age Demographic Optimization** (Kids & Families, Young Adults & Trendsetters 18-35, Romantic Couples, Seniors & Multi-Gen, All Ages Welcome)

---

## 🚀 Quickstart

### Method 1: Using the Native C++ Web Server (Recommended)

Run the one-click script:
```bash
cd "folder 2"
./run.sh
```

Or compile and run with `make`:
```bash
cd "folder 2"
make run
```

Then open your browser at:
👉 **[http://localhost:8080](http://localhost:8080)**

### Method 2: Standalone Client Mode
You can also directly open `public/index.html` in any modern web browser. The application includes a smart dual-mode architecture that seamlessly serves all features, filters, and modals even without an active server.

---

## 🛠️ Architecture & Technologies

### 1. C++ POSIX Web Server (`server.cpp`)
- Built with **C++17** (`clang++` / `g++`).
- Zero external package dependencies.
- Multi-threaded socket server handling concurrent HTTP/1.1 requests.
- Endpoints:
  - `GET /` -> Serves `public/index.html`
  - `GET /styles.css`, `GET /app.js`, `GET /data.json` -> Serves static assets with appropriate MIME types.
  - `GET /api/dining` -> REST endpoint supporting multi-parameter filtering (`tradition`, `cuisine`, `age_group`, `search`, `sort`).
  - `GET /api/filters` -> Returns metadata for tradition tags, cuisines, and demographics.
  - `POST /api/reserve` -> Processes table reservations and generates booking references (`SAVOR-XXXXX`).

### 2. Semantic HTML5 (`public/index.html`)
- Structured with accessible semantic tags (`<header>`, `<main>`, `<section>`, `<article>`, `<dialog>`).
- Interactive Tri-Pillar Filter toolbar.
- Responsive dining showcase gallery.
- Restaurant detail modal with cultural etiquette guides and table reservation drawer.

### 3. Vanilla CSS Design System (`public/styles.css`)
- **Luxury Dark Palette**: Obsidian base (`#090c10`), gold/amber highlights (`#e5a93c`, `#f59e0b`), terracotta accents (`#e05a47`), and emerald green (`#10b981`).
- **Glassmorphism**: Translucent backdrop blurs (`backdrop-filter: blur(18px)`), floating ambient orbs, and card elevation hover micro-animations.
- **Modern Typography**: Google Fonts (`Playfair Display` serif headers and `Plus Jakarta Sans` sans-serif UI).
- **Responsive Layout**: Adapts smoothly from mobile screens up to 4K displays.

### 4. JavaScript Logic (`public/app.js`)
- Dual-mode data loader with fallback resilience.
- Real-time client-side search and multi-pillar filtering.
- Dynamic active filter chips with one-click dismiss.
- LocalStorage bookmark/favorite persistence.
- Interactive reservation booking submission to the C++ server.
- Keyboard navigation (press `/` to search, `Escape` to close modals).

---

## 📁 Project Structure

```
folder 2/
├── Makefile              # Build targets: all, run, clean
├── run.sh                # Executable script to compile and launch
├── server.cpp            # Native C++ HTTP Web Server & REST API
├── README.md             # Documentation
└── public/
    ├── index.html        # Main HTML5 structure
    ├── styles.css        # Luxury design system & glassmorphism
    ├── app.js            # Frontend JavaScript application logic
    └── data.json         # Curated dining options dataset
```
