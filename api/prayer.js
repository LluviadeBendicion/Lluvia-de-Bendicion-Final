// Vercel Serverless Function de ejemplo.
// Conecta aquí tu proveedor de correo o base de datos. No guardes secretos en el navegador.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { name = "", request = "" } = req.body || {};
  if (!request.trim()) return res.status(400).json({ error: "Prayer request is required" });
  return res.status(200).json({ ok: true, message: "Endpoint preparado; conecta un proveedor seguro." });
}