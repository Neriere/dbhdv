export default async function handler(req: any, res: any) {
  try {
    // Importamos la aplicación dinámicamente.
    // Si algo dentro de server.ts o Turso rompe, caerá en el bloque catch.
    const serverModule = await import("../server");
    const app = serverModule.default;
    return app(req, res);
  } catch (error: any) {
    console.error("FATAL IMPORT ERROR:", error);

    // Forzamos a Vercel a escupir el error real en la respuesta HTTP
    res.status(500).json({
      error: "El servidor colapsó al intentar cargar el código inicial",
      message: error.message,
      stack: error.stack,
    });
  }
}
