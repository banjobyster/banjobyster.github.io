// Helpers for reading portfolio data straight from GitHub.
//
//  - raw.githubusercontent.com  -> raw repo files from a CDN, NOT rate limited,
//    no token. Used to read each repo's portfolio/ folder.
//  - api.github.com             -> REST API, public but rate limited to
//    60 req/hour per IP unauthenticated. Used ONCE to list the repos.

import { GITHUB_USER } from "../data/projects";

export function rawUrl(repo, branch, path) {
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${repo}/${branch}/${path}`;
}

export function coverUrl(repo, branch, cover) {
  return rawUrl(repo, branch, `portfolio/${cover}`);
}

// Read portfolio/project.json from a repo's default branch. Returns the parsed
// manifest, or null if the repo has no portfolio/ folder.
export async function fetchManifest(repo, branch) {
  try {
    const res = await fetch(rawUrl(repo, branch, "portfolio/project.json"));
    if (res.ok) return await res.json();
  } catch {
    // offline / network error — treated as "no manifest"
  }
  return null;
}

// List all public repos for the user (includes default_branch, description,
// language, stars, etc.). Throws on rate limit / network error.
export async function listRepos() {
  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`
  );
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  return res.json();
}
