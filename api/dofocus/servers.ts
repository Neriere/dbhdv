const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "X-Dofocus-Client": "web",
  Referer: "https://dofocus.fr/",
  Origin: "https://dofocus.fr",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const FALLBACK_SERVERS = [
  { _id: "draconiros", name: "Draconiros" },
  { _id: "kourial", name: "Kourial" },
  { _id: "mikhal", name: "Mikhal" },
  { _id: "dakal", name: "Dakal" },
  { _id: "brial", name: "Brial" },
  { _id: "rafal", name: "Rafal" },
  { _id: "salar", name: "Salar" },
  { _id: "talkasha", name: "TalKasha" },
  { _id: "hellmina", name: "HellMina" },
  { _id: "imagiro", name: "Imagiro" },
  { _id: "orukam", name: "Orukam" },
  { _id: "tylezia", name: "Tylezia" },
  { _id: "ombre", name: "Ombre" },
];

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  try {
    const response = await fetch(`${DOFOCUS_BASE_URL}/servers`, {
      headers: DOFOCUS_HEADERS,
    });

    if (!response.ok) {
      return res.status(200).json(FALLBACK_SERVERS);
    }

    const data = await response.json();
    return res.status(200).json(Array.isArray(data) && data.length > 0 ? data : FALLBACK_SERVERS);
  } catch (err: any) {
    console.error("[DoFocus Servers API Error]:", err);
    return res.status(200).json(FALLBACK_SERVERS);
  }
}
