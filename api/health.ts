export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ status: "ok", message: "pong", service: "DofusDB API Proxy & Explorer Server", time: Date.now() });
}
