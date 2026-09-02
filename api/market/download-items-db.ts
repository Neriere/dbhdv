import { getItemsDictionary } from "../../src/server/localDataStore";

export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Disposition", "attachment; filename=items_db.json");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=1800");

    const dict = await getItemsDictionary();
    res.status(200).send(JSON.stringify(dict, null, 2));
  } catch (error: any) {
    console.error("[Download Items DB Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({});
  }
}
