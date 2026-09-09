import https from "https";

https.get("https://dofocus.fr/assets/index-Cfib3gmN.js", (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    // Find all occurrences of "api" in backticks or strings
    const strMatches = data.match(/`[^`]*api[^`]*`/g) || [];
    console.log("Backtick templates with api:", strMatches);

    // Find occurrences of axios / fetch
    const fetchMatches = data.match(/fetch\s*\([^)]+\)/g) || [];
    console.log("Fetch matches:", fetchMatches.slice(0, 20));

    // Find occurrences of endpoints like /items, /prices, /coefficients, /servers
    const allEndpoints = data.match(/["'`](?:\/api)?\/[a-zA-Z0-9_\-\/]+["'`]/g) || [];
    const unique = [...new Set(allEndpoints)].filter(x => x.length > 3 && !x.includes(".png") && !x.includes(".svg") && !x.includes(".js") && !x.includes(".css"));
    console.log("Unique endpoint-like strings:", unique);
  });
});
