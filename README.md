# Sayan Bakshi's Portfolio

Welcome to my personal portfolio website! This is a React-based portfolio showcasing my projects, skills, and experience as a software engineer.

## 🚀 About Me

I am Sayan Bakshi, a computer science graduate with experience in full stack development. I have worked across various steps of the software development lifecycle as part of my internships, with exposure to documentation, testing and deployment as well.

I enjoy learning new things, and the process of building things ground up. I also find delight participating in competitive coding contests and building games.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: CSS3 with custom animations
- **Project data**: Read live from each repo's `portfolio/` folder (GitHub API + raw content)
- **Deployment**: GitHub Pages
- **Icons**: Font Awesome

## 📁 Project Structure

```
banjobyster.github.io/
├── src/
│   ├── App.jsx              # Page layout (hero, projects, about, footer)
│   ├── App.css              # All styles
│   ├── main.jsx             # Vite entry point
│   ├── data/projects.js     # Config + offline FALLBACK project list
│   ├── hooks/useProjects.js # Repo-driven data fetching
│   ├── lib/github.js        # GitHub API + raw-content helpers
│   ├── lib/text.jsx         # **highlight** renderer for descriptions
│   └── components/          # ProjectCard, RepoCard
├── public/                  # favicon + fallback project images
├── templates/portfolio/     # Template for a repo's portfolio/ folder
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies and scripts
```

## 🧩 How projects load (repo-driven)

The project cards are **not** hardcoded. On load, the site:

1. Lists the user's GitHub repos (one `api.github.com` call).
2. For each repo, tries to read `portfolio/project.json` from its **default branch** via
   `raw.githubusercontent.com` (a CDN — no token, not rate limited).
   - **Has a `portfolio/` folder →** it becomes a **featured card**, ordered by the manifest's `order`.
   - **No folder →** it appears in the **"More on GitHub"** section (name, description, language,
     stars — all from the API).
3. Covers, descriptions, tags and links all come from each repo's `portfolio/project.json`
   and `portfolio/cover.*`.

To add or reorder a project you edit that repo's `portfolio/` folder — **no site code changes**.
See [`templates/portfolio/`](templates/portfolio) for the schema.

If the API list call fails (e.g. the 60-req/hour unauthenticated limit on a shared IP), the site
falls back to the local list in [`src/data/projects.js`](src/data/projects.js) so the page is
never empty.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/banjobyster/banjobyster.github.io.git
cd banjobyster.github.io
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and deploy to GitHub Pages

## 🌐 Deployment

The website is deployed to GitHub Pages using the `gh-pages` package. The deployment process is **manual** and requires running the deploy command after making changes.

### Deployment Process

1. Builds the project using Vite
2. Deploys the `dist` folder to the `gh-pages` branch
3. GitHub Pages serves the content from the `gh-pages` branch

### Manual Deployment

To deploy your changes:

```bash
npm run deploy
```

**Note**: This command will automatically run the build process and then deploy to GitHub Pages. Make sure all your changes are committed to your main branch before deploying.

## 📧 Contact

- **Email**: sayanbakshi2002@gmail.com
- **LinkedIn**: [Sayan Bakshi](https://www.linkedin.com/in/sayan-bakshi-103546204/)
- **GitHub**: [banjobyster](https://github.com/banjobyster)
- **Instagram**: [bakshi_sayan](https://www.instagram.com/bakshi_sayan/)

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
