import fs from "fs";

const code = fs.readFileSync("/tmp/dofocus.js", "utf8");

// Find where `const me =` or `me=` is defined
const meIndex = code.indexOf(",me=");
if (meIndex !== -1) {
  console.log("me definition:", code.slice(meIndex - 50, meIndex + 250));
}

// Find axios default headers or interceptors
const defaultsMatch = code.match(/defaults\.headers[^\n;]+/g);
console.log("defaults.headers:", defaultsMatch);

// Find any api key or custom header in the code
const customHeaders = code.match(/headers\s*:\s*\{[^}]+\}/g);
console.log("custom headers:", customHeaders);

// Search for any fetch / request that sets headers
const requestHeaders = code.match(/["'][xX]-[a-zA-Z0-9-]+["']/g);
console.log("Custom X- headers:", requestHeaders);
