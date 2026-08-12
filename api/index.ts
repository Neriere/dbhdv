export default async function handler(req: any, res: any) {
  try {
    // Importa la aplicación dinámicamente para atrapar errores de inicialización
    const appModule = await import("./app");
    const app = appModule.default;
    return app(req, res);
  } catch (error: any) {
    console.error("ERROR FATAL DE INICIO:", error);

    res.status(500).json({
      error: "Fallo fatal al iniciar el servidor",
      message: error.message,
      stack: error.stack,
    });
  }
}
