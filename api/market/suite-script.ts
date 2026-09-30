import fs from "fs";
import path from "path";

export default function handler(req: any, res: any) {
  const suitePath = path.join(process.cwd(), "sniffer", "dofus_suite.py");

  if (!fs.existsSync(suitePath)) {
    return res.status(404).send("# Error: dofus_suite.py no encontrado en el servidor.");
  }

  const scriptContent = fs.readFileSync(suitePath, "utf-8");

  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="dofus_suite.py"');
  return res.send(scriptContent);
}
