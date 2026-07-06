import { useEffect, useState } from "react";
import { FALLBACK, EXCLUDE_REPOS, featuredCompare } from "../data/projects";
import { fetchManifest, coverUrl, listRepos } from "../lib/github";

// Repo-driven data hook.
//
//  1. List the repos (one rate-limited API call).
//  2. Probe every repo for a portfolio/ folder (raw CDN, not rate limited).
//     - has folder  -> featured card, ordered by manifest `order`
//     - no folder   -> "More on GitHub" compact card
//  3. If the API list call fails, fall back to the local FALLBACK list so the
//     page is never empty.
//
// `featured` starts as FALLBACK so the page paints instantly, then is replaced
// by the live repo-driven set.
function buildFeatured(repo, m) {
  return {
    id: repo.name,
    title: m.title ?? repo.name,
    tagline: m.tagline,
    description: m.description ?? repo.description ?? "",
    image: m.cover ? coverUrl(repo.name, repo.default_branch, m.cover) : undefined,
    link: m.demo || repo.html_url,
    accent: m.accent ?? "#C1A1D3",
    tags: m.tags,
    order: m.order ?? 999,
    vibeCoded: m.vibeCoded === true,
  };
}

export function useProjects() {
  const [featured, setFeatured] = useState(() => [...FALLBACK].sort(featuredCompare));
  const [repos, setRepos] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let all;
      try {
        all = await listRepos();
      } catch {
        if (!cancelled) setState("error"); // keep FALLBACK featured, no repo list
        return;
      }

      const candidates = all
        .filter((r) => !r.fork && !r.archived)
        .filter((r) => !EXCLUDE_REPOS.includes(r.name));

      const probed = await Promise.all(
        candidates.map(async (r) => ({
          repo: r,
          manifest: await fetchManifest(r.name, r.default_branch),
        }))
      );

      const feat = [];
      const more = [];
      for (const { repo, manifest } of probed) {
        if (manifest && manifest.featured !== false) feat.push(buildFeatured(repo, manifest));
        else more.push(repo);
      }

      feat.sort(featuredCompare);
      more.sort(
        (a, b) =>
          b.stargazers_count - a.stargazers_count ||
          new Date(b.pushed_at) - new Date(a.pushed_at)
      );

      if (!cancelled) {
        if (feat.length) setFeatured(feat); // else keep FALLBACK
        setRepos(more);
        setState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { featured, repos, state };
}
