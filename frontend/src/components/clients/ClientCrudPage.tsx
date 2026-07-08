import { PartnerCrudPage } from "../partners/PartnerCrudPage";

export function ClientCrudPage() {
  return (
    <PartnerCrudPage
      partnerType="client"
      accent="cyan"
      eyebrow="Clientes"
      title="Catalogo de clientes"
      description="Mantiene tu cartera comercial en una sola vista con el mismo flujo de captura, edicion y baja logica que ya usamos en el resto del sistema."
      createLabel="Agregar cliente"
      recordLabel="cliente"
      searchPlaceholder="Nombre, RFC, contacto..."
      emptyTitle="No se encontraron clientes"
      emptyDescription="Crea tu primer cliente y aparecera aqui al instante."
    />
  );
}
