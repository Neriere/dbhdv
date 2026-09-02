const fs = require('fs');
const zlib = require('zlib');
const json = fs.readFileSync('./src/data/staticItemsDictionary.json', 'utf-8');
const gzipped = zlib.gzipSync(Buffer.from(json, 'utf-8'));
const base64 = gzipped.toString('base64');
console.log('Original JSON size:', (json.length/1024).toFixed(1), 'KB');
console.log('Gzipped Base64 size:', (base64.length/1024).toFixed(1), 'KB');

const code = `import zlib from "zlib";

const COMPRESSED_DICT = "${base64}";

let cachedJson = "";

export default function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Disposition", "attachment; filename=items_db.json");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    if (!cachedJson) {
      cachedJson = zlib.gunzipSync(Buffer.from(COMPRESSED_DICT, "base64")).toString("utf-8");
    }
    return res.status(200).send(cachedJson);
  } catch (error: any) {
    console.error("[Download Items DB Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({});
  }
}
`;

fs.writeFileSync('./api/market/download-items-db.ts', code, 'utf-8');

const dictCode = `import zlib from "zlib";

const COMPRESSED_DICT = "${base64}";

let cachedParsed: any = null;

export default function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    if (!cachedParsed) {
      const str = zlib.gunzipSync(Buffer.from(COMPRESSED_DICT, "base64")).toString("utf-8");
      cachedParsed = JSON.parse(str);
    }
    return res.status(200).json(cachedParsed);
  } catch (error: any) {
    console.error("[Items Dictionary API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({});
  }
}
`;

fs.writeFileSync('./api/market/items-dictionary.ts', dictCode, 'utf-8');
console.log('Successfully wrote ultra-compact download-items-db.ts and items-dictionary.ts');
