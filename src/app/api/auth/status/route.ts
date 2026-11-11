// Estado de los proveedores de acceso social (para la UI)
// Proveedores gratuitos: Google y Microsoft
export async function GET() {
  return Response.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET),
  })
}
