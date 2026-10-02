import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PATTERN_MAP: Record<string, string> = {
  "array": "Arrays",
  "array / string": "Arrays",
  "string": "Strings",
  "hash table": "Hashing",
  "two pointers": "Two Pointers",
  "sliding window": "Sliding Window",
  "binary search": "Binary Search",
  "stack": "Stack",
  "monotonic stack": "Monotonic Stack",
  "heap": "Heap / Top K",
  "priority queue": "Heap / Top K",
  "breadth-first search": "BFS",
  "bfs": "BFS",
  "depth-first search": "DFS",
  "dfs": "DFS",
  "backtracking": "Backtracking",
  "greedy": "Greedy",
  "dynamic programming": "Dynamic Programming",
  "union find": "Union Find",
  "topological sort": "Topological Sort",
  "trie": "Trie"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function clean(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function slugFromLeetCode(url: URL) {
  const match = url.pathname.match(/\/problems\/([^/]+)/i);
  return match?.[1] || null;
}

async function fetchLeetCode(slug: string) {
  const response = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0"
    },
    body: JSON.stringify({
      query: `query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { title difficulty topicTags { name } } }`,
      variables: { titleSlug: slug }
    })
  });

  if (!response.ok) throw new Error("LeetCode request failed");
  const body = await response.json();
  const q = body?.data?.question;
  if (!q) throw new Error("LeetCode problem not found");

  const rawTopics = (q.topicTags || []).map((x: { name: string }) => clean(x.name));
  const topicAliases: Record<string, string> = {
    "array": "Arrays",
    "string": "Strings",
    "hash table": "Hashing",
    "linked list": "Linked List",
    "binary tree": "Trees",
    "binary search tree": "Binary Search Tree",
    "graph": "Graphs",
    "heap (priority queue)": "Heap / Priority Queue",
    "priority queue": "Heap / Priority Queue",
    "dynamic programming": "Dynamic Programming",
    "backtracking": "Backtracking",
    "greedy": "Greedy",
    "math": "Math",
    "matrix": "Matrix",
    "bit manipulation": "Bit Manipulation",
    "trie": "Trie"
  };
  const topics = rawTopics.map((x: string) => topicAliases[x.toLowerCase()] || x);
  const pattern = rawTopics.map((x: string) => PATTERN_MAP[x.toLowerCase()]).find(Boolean) || "";

  return {
    title: clean(q.title),
    difficulty: clean(q.difficulty),
    topics,
    pattern
  };
}

async function fetchGeneric(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 DSA-Tracker/1.0" }
  });
  if (!response.ok) throw new Error(`Page returned ${response.status}`);

  const html = await response.text();
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  let title = clean(titleMatch?.[1]);
  title = title.replace(/\s*[-|–—]\s*(LeetCode|GeeksforGeeks|GFG|Codeforces).*$/i, "").trim();

  if (!title) throw new Error("Could not read the page title");
  return { title, difficulty: "", topics: [], pattern: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const { url: rawUrl } = await req.json();
    if (!rawUrl) return json({ error: "URL is required" }, 400);

    const url = new URL(rawUrl);
    let result;

    if (url.hostname.toLowerCase().includes("leetcode.com")) {
      const slug = slugFromLeetCode(url);
      if (!slug) throw new Error("Invalid LeetCode problem URL");
      result = await fetchLeetCode(slug);
    } else {
      result = await fetchGeneric(url.toString());
    }

    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to fetch problem" }, 400);
  }
});
