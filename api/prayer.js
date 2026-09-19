// LLDB — recepción segura de peticiones. No publica automáticamente.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { name = "", city = "", topic = "", request = "", confidential = false } = req.body || {};
  const cleanRequest = String(request).trim();
  if (!cleanRequest) return res.status(400).json({ error: "Prayer request is required" });
  if (cleanRequest.length > 5000) return res.status(400).json({ error: "Prayer request is too long" });
  const item = {
    name: String(name).trim().slice(0,120),
    city: String(city).trim().slice(0,160),
    topic: String(topic).trim().slice(0,80),
    request: cleanRequest,
    confidential: Boolean(confidential),
    status: "pending_approval"
  };
  // Próximo paso: persistir item en el almacén privado del Panel Maestro.
  // Nunca publicar desde este endpoint; Omar/Ever deben revisar y aprobar.
  return res.status(202).json({ ok: true, status: item.status });
}
