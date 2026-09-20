// LLDB — recepción de peticiones en entorno de prueba.
// No publica automáticamente y todavía no persiste datos privados.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { name = "", city = "", topic = "", request = "", confidential = false } = req.body || {};
  const cleanRequest = String(request).trim();
  if (!cleanRequest) return res.status(400).json({ error: "Prayer request is required" });
  if (cleanRequest.length > 5000) return res.status(400).json({ error: "Prayer request is too long" });
  const normalizedTopic = String(topic).trim().toLowerCase();
  const crisis = normalizedTopic === "suicidio";
  return res.status(202).json({
    ok: true,
    status: "pending_approval",
    moderationRequired: true,
    publishAutomatically: false,
    persisted: false,
    message: "Formulario validado. El almacenamiento privado del Panel Maestro está pendiente de conexión.",
    followUp: { assignedTo: null, status: "pending_assignment", notes: [], nextFollowUp: null },
    audit: { originalPreserved: true, approverRequired: true },
    crisisResources: crisis ? {
      us988: "Llama o envía un mensaje de texto al 988.",
      spanish: "En español: llama al 988 y presiona 2, o envía AYUDA al 988.",
      emergency: "Si hay peligro inmediato, llama al 911."
    } : null
  });
}
