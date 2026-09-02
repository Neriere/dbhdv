import { buildItemsDictionary } from "../../src/data/itemsDictionaryData";

export default function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");

    const dict = buildItemsDictionary();
    return res.status(200).json(dict);
  } catch (error: any) {
    console.error("[Items Dictionary Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({});
  }
}
